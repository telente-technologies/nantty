import { requireAccountAccess, findRecordInAccount } from "@/mocks/mockAccountAccess.mock";
import { estimateAudienceForRequest } from "@/mocks/mockAudienceEstimator.mock";
import { throwIfValidationIssues, validateAudienceSpec } from "@/mocks/mockCampaignValidation.mock";
import { appendMockActivity, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockId, failValidation, paginateItems, readIsoNow, readJsonObjectBody, readRequiredTrimmedString, requirePrincipal, respondWithJson, respondWithNoContent } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import { demoBehaviours, demoLocations, demoTopics } from "@/mocks/seed/demoTargeting.mock";
import type { AdPlacement, CampaignObjective } from "@/types/campaign.type";
import type { CustomAudience, EngagementSource } from "@/types/audience.type";

const engagementSourceDescriptions: Record<EngagementSource, string> = {
  any_post: "Liked, commented on or saved any post.",
  clips_watched: "Watched at least half of a clip.",
  live_viewers: "Joined one of your live shopping sessions.",
  saved_products: "Saved one of your products.",
  messaged: "Sent your profile a message.",
};

export function registerAudienceMockHandlers(): void {
  registerMockRoute("GET", "/topics", () => respondWithJson(200, demoTopics), { public: true });
  registerMockRoute("GET", "/ads/behaviours", (request) => {
    requirePrincipal(request);
    return respondWithJson(200, { items: demoBehaviours });
  });
  registerMockRoute("GET", "/ads/locations", (request) => {
    requirePrincipal(request);
    const search = (request.query.get("search") ?? "").trim().toLowerCase();
    const countryCode = request.query.get("countryCode");
    const items = demoLocations.filter((location) => (!countryCode || location.countryCode === countryCode) && (!search || `${location.name} ${location.parentName ?? ""}`.toLowerCase().includes(search))).slice(0, 25);
    return respondWithJson(200, { items });
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/audiences", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:view");
    const type = request.query.get("type");
    const audiences = readMockDatabase().audiences.filter((audience) => audience.accountId === account.id && (!type || audience.type === type));
    return respondWithJson(200, paginateItems(audiences, request, 100));
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/audiences", (request) => {
    const { account, userId, actorName } = requireAccountAccess(request, "audiences:manage");
    const body = readJsonObjectBody(request);
    const database = readMockDatabase();
    const name = readRequiredTrimmedString(body, "name", 100);
    const now = readIsoNow();
    const base = { id: createMockId("aud"), accountId: account.id, name, status: "building" as const, approximateSize: null, usedInAdSetCount: 0, createdAt: now, updatedAt: now, lookalike: null, retentionDays: null };
    let audience: CustomAudience;
    const retentionDays = Number(body.retentionDays);
    const readRetention = () => (Number.isInteger(retentionDays) && retentionDays >= 1 && retentionDays <= 365 ? retentionDays : failValidation("retentionDays", "Choose 1 to 365 days."));
    if (body.type === "store_customers") {
      if (!account.business) failValidation("type", "Store customer audiences need a business ad account linked to a store.");
      audience = { ...base, type: "store_customers", retentionDays: readRetention(), description: `People who completed at least ${Math.max(1, Number(body.minimumOrders) || 1)} order(s) in your store.` };
    } else if (body.type === "engagers") {
      const source = String(body.engagementSource) as EngagementSource;
      if (!engagementSourceDescriptions[source]) failValidation("engagementSource", "Choose what people did.");
      audience = { ...base, type: "engagers", retentionDays: readRetention(), description: engagementSourceDescriptions[source] };
    } else if (body.type === "followers") {
      audience = { ...base, type: "followers", description: "Everyone who follows the profile." };
    } else if (body.type === "lookalike") {
      const sourceAudience = findRecordInAccount(database.audiences, account.id, String(body.sourceAudienceId ?? ""), "source audience");
      if (sourceAudience.type === "lookalike") failValidation("sourceAudienceId", "A lookalike cannot be based on another lookalike.");
      const similarityPercent = Number(body.similarityPercent);
      if (!Number.isInteger(similarityPercent) || similarityPercent < 1 || similarityPercent > 10) failValidation("similarityPercent", "Choose between 1% and 10%.");
      const countryCode = String(body.countryCode ?? "");
      if (!/^[A-Z]{2}$/.test(countryCode)) failValidation("countryCode", "Choose a country.");
      audience = { ...base, type: "lookalike", description: `People in ${countryCode} most similar to "${sourceAudience.name}".`, lookalike: { sourceAudienceId: sourceAudience.id, countryCode, similarityPercent } };
    } else {
      throw new MockHttpError(400, "VALIDATION_FAILED", "Choose an audience type.");
    }
    database.audiences.unshift(audience);
    setTimeout(() => {
      const created = database.audiences.find((candidate) => candidate.id === audience.id);
      if (!created) return;
      const center = created.type === "lookalike" ? 380_000 * (created.lookalike?.similarityPercent ?? 1) : created.type === "followers" ? 21_000 : created.type === "engagers" ? 26_000 : 3_200;
      Object.assign(created, { status: "ready", approximateSize: { lower: Math.round(center * 0.88), upper: Math.round(center * 1.1) }, updatedAt: readIsoNow() });
    }, 8000);
    appendMockActivity(account.id, { actor: { id: userId, name: actorName, isSystem: false }, action: "audience_created", objectType: "audience", objectId: audience.id, objectName: audience.name, summary: `Created a ${audience.type.replace("_", " ")} audience`, changes: [] });
    return respondWithJson(201, audience);
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/audiences/customer-lists", (request) => {
    const { account, userId, actorName } = requireAccountAccess(request, "audiences:manage");
    const body = readJsonObjectBody(request);
    const name = readRequiredTrimmedString(body, "name", 100);
    if (body.hashAlgorithm !== "sha256") failValidation("hashAlgorithm", "Identifiers must be SHA-256 hashed.");
    if (body.identifierType !== "email" && body.identifierType !== "phone") failValidation("identifierType", "Choose email or phone.");
    const hashes = Array.isArray(body.hashedIdentifiers) ? body.hashedIdentifiers : [];
    if (hashes.length === 0 || hashes.length > 50_000) failValidation("hashedIdentifiers", "Upload between 1 and 50,000 rows.");
    if (!hashes.every((hash) => typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash))) failValidation("hashedIdentifiers", "Every row must be a lowercase SHA-256 hex digest. Raw emails or phone numbers are refused.");
    const matched = Math.round(hashes.length * 0.62);
    const now = readIsoNow();
    const audience: CustomAudience = { id: createMockId("aud"), accountId: account.id, name, type: "customer_list", status: matched < 100 ? "too_small" : "ready", approximateSize: { lower: Math.round(matched * 0.9), upper: Math.round(matched * 1.1) }, retentionDays: null, description: `Customer list matched by hashed ${body.identifierType === "email" ? "emails" : "phone numbers"} (${hashes.length.toLocaleString("en")} rows uploaded).`, lookalike: null, usedInAdSetCount: 0, createdAt: now, updatedAt: now };
    readMockDatabase().audiences.unshift(audience);
    appendMockActivity(account.id, { actor: { id: userId, name: actorName, isSystem: false }, action: "customer_list_uploaded", objectType: "audience", objectId: audience.id, objectName: name, summary: `Uploaded ${hashes.length} hashed rows`, changes: [] });
    return respondWithJson(201, audience);
  });

  registerMockRoute("PATCH", "/ads/accounts/:accountId/audiences/:audienceId", (request) => {
    const { account } = requireAccountAccess(request, "audiences:manage");
    const audience = findRecordInAccount(readMockDatabase().audiences, account.id, request.params.audienceId, "audience");
    Object.assign(audience, { name: readRequiredTrimmedString(readJsonObjectBody(request), "name", 100), updatedAt: readIsoNow() });
    return respondWithJson(200, audience);
  });

  registerMockRoute("DELETE", "/ads/accounts/:accountId/audiences/:audienceId", (request) => {
    const { account } = requireAccountAccess(request, "audiences:manage");
    const database = readMockDatabase();
    const audience = findRecordInAccount(database.audiences, account.id, request.params.audienceId, "audience");
    const isInUse = database.adSets.some((adSet) => adSet.status !== "completed" && [...adSet.audience.customAudienceIds, ...adSet.audience.excludedCustomAudienceIds].includes(audience.id));
    if (isInUse) throw new MockHttpError(409, "AUDIENCE_IN_USE", "This audience is used by an ad set that is still running. Remove it there first.");
    database.audiences.splice(database.audiences.indexOf(audience), 1);
    return respondWithNoContent();
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/estimates/audience", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:view");
    const body = readJsonObjectBody(request);
    const issues: { path: string; message: string }[] = [];
    const audience = validateAudienceSpec(body.audience, "audience", account.id, issues);
    const locationIssue = issues.find((issue) => issue.path !== "audience.locations");
    throwIfValidationIssues(locationIssue ? [locationIssue] : []);
    const placements = Array.isArray(body.placements) ? (body.placements.filter((placement) => typeof placement === "string") as AdPlacement[]) : [];
    const schedule = typeof body.schedule === "object" && body.schedule ? (body.schedule as { startAt: string; endAt: string | null }) : { startAt: new Date().toISOString(), endAt: null };
    const budget = typeof body.budget === "object" && body.budget ? (body.budget as { type: "daily" | "lifetime"; amount: { amountMinor: number; currency: string } }) : null;
    if (budget && budget.amount.currency !== account.currency) failValidation("budget.amount", `Amounts must be in ${account.currency}.`);
    const bidStrategy = typeof body.bidStrategy === "object" && body.bidStrategy ? (body.bidStrategy as { type: "auto"; amount: null }) : { type: "auto" as const, amount: null };
    return respondWithJson(200, estimateAudienceForRequest(account.id, account.currency, { objective: String(body.objective ?? "awareness") as CampaignObjective, audience, placements: placements.length > 0 ? placements : ["feed"], budget, bidStrategy, schedule }));
  });
}
