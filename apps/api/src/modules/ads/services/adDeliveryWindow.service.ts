import { adsConflict, type ValidationIssue } from "../../../errors/ads.error.js";
import type { AdAccountRecord } from "../models/adAccounts.model.js";
import type { AdCampaignRecord, AdPlacement, AdRecord, AdSetRecord, CreativeInput, NewAdInput } from "../models/adCampaigns.model.js";
import type { AdEventFilter } from "../models/adDelivery.model.js";
import type { AdsDependencies } from "../models/adsDependencies.model.js";
import type { AdCreativesService } from "./adCreatives.service.js";
import { describeCreativeShape, describeWhyCreativeCannotRunAnywhere, listPlacementsWhereCreativeCanRun } from "./adPlacementRules.service.js";
import type { DeliveryWindow } from "./adPresenter.service.js";

export interface DeliveryRange {
  readonly from?: string | undefined;
  readonly to?: string | undefined;
}

export function startOfUtcDay(moment: Date): Date {
  return new Date(Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), moment.getUTCDate()));
}

export async function loadDeliveryWindow(dependencies: AdsDependencies, filter: AdEventFilter, range: DeliveryRange): Promise<DeliveryWindow> {
  const from = range.from === undefined ? undefined : new Date(`${range.from}T00:00:00.000Z`);
  const to = range.to === undefined ? undefined : new Date(new Date(`${range.to}T00:00:00.000Z`).getTime() + 86_400_000);
  const events = await dependencies.delivery.listEvents({ ...filter, ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }) });
  return { events, todayStart: startOfUtcDay(dependencies.clock.now()) };
}

export function assertAccountActive(account: AdAccountRecord): void {
  if (account.status !== "active") throw adsConflict("AD_ACCOUNT_NOT_ACTIVE", "This ad account is not active.");
}

export type AdDraft = Omit<NewAdInput, "accountId" | "campaignId" | "adSetId">;

export async function resolveAdDraft(
  creatives: AdCreativesService,
  account: AdAccountRecord,
  placements: readonly AdPlacement[],
  name: string,
  creativeInput: CreativeInput,
  path: string,
  issues: ValidationIssue[],
): Promise<AdDraft> {
  const resolved = await creatives.resolveCreative(account, creativeInput, `${path}.creative`);
  issues.push(...resolved.issues);
  const shape = describeCreativeShape(resolved.creative);
  const problem = resolved.issues.length > 0 ? null : describeWhyCreativeCannotRunAnywhere(shape, placements);
  if (problem !== null) issues.push({ path: `${path}.creative.placements`, message: problem });
  return {
    name: name.trim() === "" ? resolved.creative.headline.slice(0, 120) || "Ad" : name.trim().slice(0, 120),
    status: "draft",
    reviewStatus: "not_submitted",
    policyCode: null,
    policyReason: null,
    reviewedAt: null,
    reviewedById: null,
    appeal: null,
    autoCheckFlags: [],
    submittedAt: null,
    creativeInput,
    creative: resolved.creative,
    deliverablePlacements: listPlacementsWhereCreativeCanRun(shape, placements),
  };
}

export function attachAdDraft(draft: AdDraft, account: AdAccountRecord, campaign: AdCampaignRecord, adSet: AdSetRecord): NewAdInput {
  return { ...draft, accountId: account.id, campaignId: campaign.id, adSetId: adSet.id };
}

export function isEditableByAdvertiser(record: AdCampaignRecord | AdSetRecord | AdRecord): boolean {
  return record.status !== "completed";
}
