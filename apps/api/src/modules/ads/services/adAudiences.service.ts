import { adsError, adsNotFound, throwIfValidationIssues } from "../../../errors/ads.error.js";
import { AD_BEHAVIOURS, AD_LOCATIONS, ENGAGEMENT_SOURCE_DESCRIPTIONS, REACHABLE_PEOPLE_BY_LOCATION_CODE } from "../constants/adTargeting.constant.js";
import type { AdAccountRecord } from "../models/adAccounts.model.js";
import { MINIMUM_TARGETABLE_AUDIENCE_SIZE, type CustomAudienceRecord, type EngagementSource, type HashedIdentifierType, type NewCustomAudienceInput } from "../models/adAudiences.model.js";
import type { AdsDependencies } from "../models/adsDependencies.model.js";
import type { AdsToolsOptions, AdsToolsRepositories } from "../models/adsToolsDependencies.model.js";
import { paginateAdsItems, type AdAccountAccess } from "./adAccountAccess.service.js";

const MAXIMUM_LOCATION_RESULTS = 25;
const MAXIMUM_CUSTOMER_LIST_ROWS = 50_000;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export type CreateCustomAudienceInput =
  | { readonly type: "store_customers"; readonly name: string; readonly retentionDays: number; readonly minimumOrders: number }
  | { readonly type: "engagers"; readonly name: string; readonly retentionDays: number; readonly engagementSource: EngagementSource }
  | { readonly type: "followers"; readonly name: string }
  | { readonly type: "lookalike"; readonly name: string; readonly sourceAudienceId: string; readonly countryCode: string; readonly similarityPercent: number };

export interface CustomerListUploadInput {
  readonly name: string;
  readonly identifierType: HashedIdentifierType;
  readonly hashAlgorithm: "sha256";
  readonly hashedIdentifiers: readonly string[];
}

export function roundToFriendlyNumber(value: number): number {
  if (value < 1000) return Math.round(value / 10) * 10;
  const magnitude = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.round(value / magnitude) * magnitude;
}

export function buildRoundedRange(center: number, spread: number) {
  return { lower: roundToFriendlyNumber(center * (1 - spread)), upper: roundToFriendlyNumber(center * (1 + spread)) };
}

export class AdAudiencesService {
  public constructor(
    private readonly dependencies: AdsDependencies,
    private readonly repositories: AdsToolsRepositories,
    private readonly access: AdAccountAccess,
    private readonly options: Pick<AdsToolsOptions, "customerListMatcher" | "audienceSizing">,
  ) {}

  public listLocations(search: string | undefined, countryCode: string | undefined) {
    const term = (search ?? "").trim().toLowerCase();
    const items = AD_LOCATIONS.filter(
      (location) => (countryCode === undefined || location.countryCode === countryCode) && (term === "" || `${location.name} ${location.parentName ?? ""}`.toLowerCase().includes(term)),
    ).slice(0, MAXIMUM_LOCATION_RESULTS);
    return Promise.resolve({ items });
  }

  public listBehaviours() {
    return Promise.resolve({ items: AD_BEHAVIOURS });
  }

  public async listAudiences(userId: string, accountId: string, type: string | undefined, cursor: string | undefined, limit: number) {
    await this.access.requirePermission(userId, accountId, "campaigns:view");
    const audiences = (await this.repositories.audiences.listAudiences(accountId)).filter((audience) => type === undefined || audience.type === type);
    const presented = await this.presentAudiences(accountId, audiences);
    return paginateAdsItems(presented, cursor, limit);
  }

  public async createAudience(userId: string, accountId: string, input: CreateCustomAudienceInput) {
    const { account } = await this.access.requirePermission(userId, accountId, "audiences:manage");
    const base = { accountId, name: input.name.trim(), matchedUserIds: [] as string[] };
    let draft: NewCustomAudienceInput;
    let size: number;
    if (input.type === "store_customers") {
      if (account.storeId === null) throwIfValidationIssues([{ path: "type", message: "Store customer audiences need a business ad account linked to a store." }]);
      draft = { ...base, type: input.type, status: "building", sizeLower: null, sizeUpper: null, retentionDays: input.retentionDays, description: `People who completed at least ${Math.max(1, input.minimumOrders)} order(s) in your store.`, definition: { minimumOrders: Math.max(1, input.minimumOrders) } };
      size = (await this.options.audienceSizing?.countStoreCustomers?.(account.storeId ?? "", input.retentionDays, Math.max(1, input.minimumOrders))) ?? 0;
    } else if (input.type === "engagers") {
      draft = { ...base, type: input.type, status: "building", sizeLower: null, sizeUpper: null, retentionDays: input.retentionDays, description: ENGAGEMENT_SOURCE_DESCRIPTIONS[input.engagementSource] ?? "", definition: { engagementSource: input.engagementSource } };
      size = (await this.options.audienceSizing?.countEngagers?.(account.ownerId, account.storeId, input.engagementSource, input.retentionDays)) ?? 0;
    } else if (input.type === "followers") {
      draft = { ...base, type: input.type, status: "building", sizeLower: null, sizeUpper: null, retentionDays: null, description: "Everyone who follows the profile.", definition: {} };
      size = await this.countFollowers(account);
    } else {
      const source = await this.repositories.audiences.findAudience(input.sourceAudienceId);
      if (source === undefined || source.accountId !== accountId) throw adsNotFound("Source audience");
      if (source.type === "lookalike") throwIfValidationIssues([{ path: "sourceAudienceId", message: "A lookalike cannot be based on another lookalike." }]);
      const lookalike = { sourceAudienceId: source.id, countryCode: input.countryCode, similarityPercent: input.similarityPercent };
      draft = { ...base, type: "lookalike", status: "building", sizeLower: null, sizeUpper: null, retentionDays: null, description: `People in ${input.countryCode} most similar to "${source.name}".`, definition: { lookalike } };
      size = source.status === "ready" ? ((REACHABLE_PEOPLE_BY_LOCATION_CODE[input.countryCode] ?? 500_000) * input.similarityPercent) / 100 : 0;
    }
    const created = await this.repositories.audiences.createAudience(draft, this.dependencies.clock.now());
    const resolved = await this.applyAudienceSize(created, size);
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "account", objectId: created.id, summary: `Created a ${created.type.replace("_", " ")} audience "${created.name}"`, changes: [] });
    const [presented] = await this.presentAudiences(accountId, [resolved]);
    return presented;
  }

  public async uploadCustomerList(userId: string, accountId: string, input: CustomerListUploadInput) {
    await this.access.requirePermission(userId, accountId, "audiences:manage");
    const hashes = input.hashedIdentifiers;
    if (hashes.length === 0 || hashes.length > MAXIMUM_CUSTOMER_LIST_ROWS) throwIfValidationIssues([{ path: "hashedIdentifiers", message: "Upload between 1 and 50,000 rows." }]);
    if (!hashes.every((hash) => SHA256_HEX_PATTERN.test(hash))) {
      throwIfValidationIssues([{ path: "hashedIdentifiers", message: "Every row must be a lowercase SHA-256 hex digest. Raw emails or phone numbers are refused." }]);
    }
    const uniqueHashes = [...new Set(hashes)];
    const matches = this.options.customerListMatcher === undefined ? [] : await this.options.customerListMatcher.matchHashedIdentifiers(input.identifierType, uniqueHashes);
    const matchedUserIds = [...new Set(matches.map((match) => match.userId))];
    const created = await this.repositories.audiences.createAudience(
      {
        accountId,
        name: input.name.trim(),
        type: "customer_list",
        status: "building",
        sizeLower: null,
        sizeUpper: null,
        retentionDays: null,
        description: `Customer list matched by hashed ${input.identifierType === "email" ? "emails" : "phone numbers"} (${hashes.length.toLocaleString("en")} rows uploaded).`,
        definition: { identifierType: input.identifierType },
        matchedUserIds,
      },
      this.dependencies.clock.now(),
    );
    await this.repositories.audiences.replaceCustomerListHashes(created.id, matches.map((match) => match.hash));
    const resolved = await this.applyAudienceSize(created, matchedUserIds.length);
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "account", objectId: created.id, summary: `Uploaded ${hashes.length} hashed rows`, changes: [] });
    const [presented] = await this.presentAudiences(accountId, [resolved]);
    return presented;
  }

  public async renameAudience(userId: string, accountId: string, audienceId: string, name: string) {
    await this.access.requirePermission(userId, accountId, "audiences:manage");
    await this.requireAudience(accountId, audienceId);
    const updated = await this.repositories.audiences.updateAudience(audienceId, { name: name.trim() }, this.dependencies.clock.now());
    const [presented] = await this.presentAudiences(accountId, [updated]);
    return presented;
  }

  public async deleteAudience(userId: string, accountId: string, audienceId: string): Promise<void> {
    await this.access.requirePermission(userId, accountId, "audiences:manage");
    await this.requireAudience(accountId, audienceId);
    const adSets = await this.dependencies.campaigns.listAdSets(accountId);
    const inUse = adSets.some((adSet) => adSet.status !== "completed" && [...adSet.audience.customAudienceIds, ...adSet.audience.excludedCustomAudienceIds].includes(audienceId));
    if (inUse) throw adsError(409, "AUDIENCE_IN_USE", "This audience is used by an ad set that is still running. Remove it there first.");
    await this.repositories.audiences.deleteAudience(audienceId);
  }

  private async requireAudience(accountId: string, audienceId: string): Promise<CustomAudienceRecord> {
    const audience = await this.repositories.audiences.findAudience(audienceId);
    if (audience === undefined || audience.accountId !== accountId) throw adsNotFound("Audience");
    return audience;
  }

  private async countFollowers(account: AdAccountRecord): Promise<number> {
    const sizing = this.options.audienceSizing;
    if (sizing === undefined) return 0;
    return account.storeId === null ? sizing.countFollowers("user", account.ownerId) : sizing.countFollowers("store", account.storeId);
  }

  private async applyAudienceSize(audience: CustomAudienceRecord, size: number): Promise<CustomAudienceRecord> {
    const tooSmall = size < MINIMUM_TARGETABLE_AUDIENCE_SIZE;
    const range = tooSmall ? null : buildRoundedRange(size, 0.1);
    return this.repositories.audiences.updateAudience(
      audience.id,
      { status: tooSmall ? "too_small" : "ready", sizeLower: range === null ? null : Math.max(MINIMUM_TARGETABLE_AUDIENCE_SIZE, range.lower), sizeUpper: range?.upper ?? null },
      this.dependencies.clock.now(),
    );
  }

  private async presentAudiences(accountId: string, audiences: readonly CustomAudienceRecord[]) {
    const adSets = await this.dependencies.campaigns.listAdSets(accountId);
    return audiences.map((audience) => ({
      id: audience.id,
      accountId: audience.accountId,
      name: audience.name,
      type: audience.type,
      status: audience.status,
      approximateSize: audience.sizeLower === null || audience.sizeUpper === null ? null : { lower: audience.sizeLower, upper: audience.sizeUpper },
      retentionDays: audience.retentionDays,
      description: audience.description,
      lookalike: audience.definition.lookalike ?? null,
      usedInAdSetCount: adSets.filter((adSet) => [...adSet.audience.customAudienceIds, ...adSet.audience.excludedCustomAudienceIds].includes(audience.id)).length,
      createdAt: audience.createdAt.toISOString(),
      updatedAt: audience.updatedAt.toISOString(),
    }));
  }
}
