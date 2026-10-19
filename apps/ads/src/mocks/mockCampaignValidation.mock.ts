import { campaignNameMaximumLength, headlineMaximumLength, primaryTextMaximumLength } from "@/constants/campaignOptions.constant";
import { readMockDatabase, type MockAdAccountRecord } from "@/mocks/mockDatabase.mock";
import { canMockAccountPromoteDestination } from "@/mocks/mockPromotableDestinations.mock";
import { MockHttpError } from "@/mocks/mockResponses.mock";
import type { AudienceSpec, LocationTarget } from "@/types/audience.type";
import type { AdInput, AdPlacement, AdSetInput, BidStrategy, Budget, CampaignInput, CampaignObjective, FrequencyCap, Schedule } from "@/types/campaign.type";
import type { CallToAction, Creative, CreativeApp, CreativeCardInput, CreativeDestination, CreativeFormat, CreativeInput, CreativeType, CreativeUtm } from "@/types/creative.type";
import type { Money } from "@/types/money.type";
import { describeWhyCreativeCannotRunAnywhere } from "@/utils/adPlacementRules.util";
import { validateCreativeTypeFields, isValidUtmValue } from "@/utils/adCreativeFormats.util";
import { isSafeHttpsUrl } from "@/utils/formValidation.util";

type Issues = { path: string; message: string }[];

const objectives: readonly CampaignObjective[] = ["awareness", "traffic", "engagement", "messages", "sales", "followers", "store_promotion"];
const placements: readonly AdPlacement[] = ["feed", "clips", "mart", "search", "stories", "live"];
const callsToAction: readonly CallToAction[] = ["shop_now", "learn_more", "visit_store", "send_message", "follow", "watch_more", "order_now", "sign_up", "install", "download", "book_now", "contact_us"];
const formats: readonly CreativeFormat[] = ["feed_post", "clip", "product", "store", "story", "live"];
const minimumDailyBudgetMinorByCurrency: Record<string, number> = { NGN: 100_000, GHS: 1_000, KES: 10_000, ZAR: 2_000, GBP: 100, EUR: 100, USD: 100 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readMoney(value: unknown, path: string, currency: string, issues: Issues): Money | null {
  if (!isRecord(value) || !Number.isInteger(value.amountMinor) || typeof value.currency !== "string") {
    issues.push({ path, message: "Enter an amount." });
    return null;
  }
  if (value.currency !== currency) issues.push({ path, message: `Amounts must be in ${currency}, the ad account currency.` });
  if ((value.amountMinor as number) <= 0) issues.push({ path, message: "Enter an amount above zero." });
  return { amountMinor: value.amountMinor as number, currency: value.currency };
}

function readSchedule(value: unknown, path: string, issues: Issues): Schedule {
  const schedule = isRecord(value) ? value : {};
  const startAt = typeof schedule.startAt === "string" && !Number.isNaN(Date.parse(schedule.startAt)) ? schedule.startAt : null;
  const endAt = typeof schedule.endAt === "string" && !Number.isNaN(Date.parse(schedule.endAt)) ? schedule.endAt : null;
  if (!startAt) issues.push({ path: `${path}.startAt`, message: "Choose a start date." });
  if (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt)) issues.push({ path: `${path}.endAt`, message: "The end must be after the start." });
  return { startAt: startAt ?? new Date().toISOString(), endAt };
}

function readBudget(value: unknown, path: string, currency: string, schedule: Schedule, issues: Issues): Budget | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || (value.type !== "daily" && value.type !== "lifetime")) {
    issues.push({ path: `${path}.type`, message: "Choose a daily or lifetime budget." });
    return null;
  }
  const amount = readMoney(value.amount, `${path}.amount`, currency, issues);
  if (!amount) return null;
  const minimumDaily = minimumDailyBudgetMinorByCurrency[currency] ?? 100;
  if (value.type === "daily" && amount.amountMinor < minimumDaily) issues.push({ path: `${path}.amount`, message: "The daily budget is below the minimum for this currency." });
  if (value.type === "lifetime" && !schedule.endAt) issues.push({ path: `${path}.type`, message: "A lifetime budget needs an end date." });
  return { type: value.type, amount };
}

export function validateCampaignInput(value: unknown, account: MockAdAccountRecord, issues: Issues): CampaignInput {
  const input = isRecord(value) ? value : {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > campaignNameMaximumLength) issues.push({ path: "campaign.name", message: `Name the campaign (up to ${campaignNameMaximumLength} characters).` });
  const objective = objectives.includes(input.objective as CampaignObjective) ? (input.objective as CampaignObjective) : null;
  if (!objective) issues.push({ path: "campaign.objective", message: "Choose an objective." });
  const budgetLevel = input.budgetLevel === "campaign" ? "campaign" : "ad_set";
  const schedule = readSchedule(input.schedule, "campaign.schedule", issues);
  const budget = budgetLevel === "campaign" ? readBudget(input.budget, "campaign.budget", account.currency, schedule, issues) : null;
  if (budgetLevel === "campaign" && !budget) issues.push({ path: "campaign.budget", message: "Set a campaign budget." });
  const spendCap = input.spendCap ? readMoney(input.spendCap, "campaign.spendCap", account.currency, issues) : null;
  return { name, objective: objective ?? "awareness", budgetLevel, budget, spendCap, schedule };
}

function readLocationList(value: unknown): LocationTarget[] {
  if (!Array.isArray(value)) return [];
  return value.filter((location): location is LocationTarget => isRecord(location) && typeof location.code === "string" && ["country", "state", "city"].includes(String(location.type))).slice(0, 50);
}

function readIdList(value: unknown, maximum: number): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id)).slice(0, maximum) : [];
}

export function validateAudienceSpec(value: unknown, path: string, accountId: string, issues: Issues): AudienceSpec {
  const input = isRecord(value) ? value : {};
  const locations = readLocationList(input.locations);
  if (locations.length === 0) issues.push({ path: `${path}.locations`, message: "Add at least one country, state or city." });
  const ageMin = Number(input.ageMin);
  const ageMax = Number(input.ageMax);
  if (!Number.isInteger(ageMin) || !Number.isInteger(ageMax) || ageMin < 18 || ageMax > 65 || ageMin > ageMax) issues.push({ path: `${path}.ageMin`, message: "Ages must be between 18 and 65+, youngest first." });
  const gender = input.gender === "female" || input.gender === "male" ? input.gender : "all";
  const customAudienceIds = readIdList(input.customAudienceIds, 20);
  const excludedCustomAudienceIds = readIdList(input.excludedCustomAudienceIds, 20);
  const ownedAudienceIds = new Set(readMockDatabase().audiences.filter((audience) => audience.accountId === accountId).map((audience) => audience.id));
  if ([...customAudienceIds, ...excludedCustomAudienceIds].some((id) => !ownedAudienceIds.has(id))) issues.push({ path: `${path}.customAudienceIds`, message: "One of the custom audiences does not belong to this ad account." });
  return { locations, excludedLocations: readLocationList(input.excludedLocations), ageMin: ageMin || 18, ageMax: ageMax || 65, gender, topicIds: readIdList(input.topicIds, 25), behaviourIds: readIdList(input.behaviourIds, 25), customAudienceIds, excludedCustomAudienceIds };
}

export function validateAdSetInput(value: unknown, account: MockAdAccountRecord, campaignBudgetLevel: "campaign" | "ad_set", issues: Issues): AdSetInput {
  const input = isRecord(value) ? value : {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > campaignNameMaximumLength) issues.push({ path: "adSet.name", message: "Name the ad set." });
  const placementMode = input.placementMode === "manual" ? "manual" : "automatic";
  const chosenPlacements = Array.isArray(input.placements) ? placements.filter((placement) => (input.placements as unknown[]).includes(placement)) : [];
  if (placementMode === "manual" && chosenPlacements.length === 0) issues.push({ path: "adSet.placements", message: "Choose at least one placement." });
  const schedule = readSchedule(input.schedule, "adSet.schedule", issues);
  const budget = campaignBudgetLevel === "ad_set" ? readBudget(input.budget, "adSet.budget", account.currency, schedule, issues) : null;
  if (campaignBudgetLevel === "ad_set" && !budget) issues.push({ path: "adSet.budget", message: "Set an ad set budget." });
  const bidInput = isRecord(input.bidStrategy) ? input.bidStrategy : { type: "auto" };
  const bidType = ["auto", "max_cpc", "max_cpm", "target_cost"].includes(String(bidInput.type)) ? (bidInput.type as BidStrategy["type"]) : "auto";
  const bidAmount = bidType === "auto" ? null : readMoney(bidInput.amount, "adSet.bidStrategy.amount", account.currency, issues);
  let frequencyCap: FrequencyCap | null = null;
  if (isRecord(input.frequencyCap)) {
    const impressions = Number(input.frequencyCap.impressions);
    const perDays = Number(input.frequencyCap.perDays);
    if (!Number.isInteger(impressions) || impressions < 1 || impressions > 20 || !Number.isInteger(perDays) || perDays < 1 || perDays > 30) issues.push({ path: "adSet.frequencyCap", message: "Frequency cap must be 1–20 impressions per 1–30 days." });
    frequencyCap = { impressions, perDays };
  }
  const conversionEventId = typeof input.conversionEventId === "string" ? input.conversionEventId : null;
  return {
    name,
    audience: validateAudienceSpec(input.audience, "adSet.audience", account.id, issues),
    placementMode,
    placements: placementMode === "automatic" ? placements : chosenPlacements,
    schedule,
    budget,
    bidStrategy: { type: bidType, amount: bidAmount },
    frequencyCap,
    conversionEventId,
  };
}

function readString(value: unknown, maximum = 500): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function readUtm(value: unknown): CreativeUtm | null {
  if (!isRecord(value)) return null;
  const utm: Record<string, string> = {};
  for (const key of ["source", "medium", "campaign", "content", "term"]) {
    const entry = readString(value[key], 60);
    if (entry && isValidUtmValue(entry)) utm[key] = entry;
  }
  return Object.keys(utm).length > 0 ? utm : null;
}

function readDestination(value: unknown): CreativeDestination {
  const destination = isRecord(value) ? value : {};
  const type = ["post", "profile", "store", "product", "messages", "url", "app_store"].includes(String(destination.type)) ? (destination.type as CreativeDestination["type"]) : "post";
  const url = typeof destination.url === "string" ? destination.url.trim() : null;
  const utm = type === "url" ? readUtm(destination.utm) : null;
  return { type, targetId: typeof destination.targetId === "string" ? destination.targetId : null, url: type === "url" ? url : null, ...(utm ? { utm } : {}) };
}

function readApp(value: unknown): CreativeApp | null {
  if (!isRecord(value)) return null;
  const rating = typeof value.rating === "number" ? value.rating : null;
  return {
    appName: readString(value.appName, 50),
    ...(typeof value.iconMediaId === "string" ? { iconMediaId: value.iconMediaId } : {}),
    rating,
    iosStoreUrl: readString(value.iosStoreUrl, 2048),
    androidStoreUrl: readString(value.androidStoreUrl, 2048),
    webFallbackUrl: readString(value.webFallbackUrl, 2048),
    iosDeepLink: readString(value.iosDeepLink, 500),
    androidDeepLink: readString(value.androidDeepLink, 500),
  };
}

function readCards(value: unknown): CreativeCardInput[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((card) => {
    const record = isRecord(card) ? card : {};
    const callToAction = callsToAction.includes(record.callToAction as CallToAction) ? (record.callToAction as CallToAction) : "learn_more";
    return { mediaId: readString(record.mediaId, 64), headline: readString(record.headline, 100), description: readString(record.description, 200), callToAction, destination: readDestination(record.destination) };
  });
}

export function validateCreativeInput(value: unknown, path: string, accountId: string, issues: Issues): CreativeInput {
  const input = isRecord(value) ? value : {};
  const format = formats.includes(input.format as CreativeFormat) ? (input.format as CreativeFormat) : "feed_post";
  const creativeTypes: readonly CreativeType[] = ["single", "carousel", "app_install", "promoted_post"];
  const type = creativeTypes.includes(input.type as CreativeType) ? (input.type as CreativeType) : "single";
  const source = isRecord(input.source) ? input.source : {};
  const sourceType = ["post", "clip", "product", "store", "live", "upload"].includes(String(source.type)) ? (source.type as CreativeInput["source"]["type"]) : "upload";
  const sourceId = typeof source.id === "string" ? source.id : "";
  const database = readMockDatabase();
  const mediaIds = readIdList(input.mediaIds, 10);
  const cards = readCards(input.cards);
  const app = readApp(input.app);
  const destination = readDestination(input.destination);
  if (sourceType !== "upload" && !database.contentSources.some((candidate) => candidate.id === sourceId && candidate.accountId === accountId && candidate.eligible)) issues.push({ path: `${path}.source`, message: "Choose an eligible post, reel, product, live session or store from this account." });
  if (sourceType === "upload" && type !== "carousel" && (mediaIds.length === 0 || mediaIds.some((mediaId) => !database.media.has(mediaId)))) issues.push({ path: `${path}.mediaIds`, message: "Upload at least one image or video." });
  if (type === "carousel" && cards.some((card) => card.mediaId && !database.media.has(card.mediaId))) issues.push({ path: `${path}.cards`, message: "One of the card images or videos was not found." });
  const headline = typeof input.headline === "string" ? input.headline.trim() : "";
  const primaryText = typeof input.primaryText === "string" ? input.primaryText.trim() : "";
  if (!headline || headline.length > headlineMaximumLength) issues.push({ path: `${path}.headline`, message: `Add a headline (up to ${headlineMaximumLength} characters).` });
  if (primaryText.length > primaryTextMaximumLength) issues.push({ path: `${path}.primaryText`, message: `Primary text can be at most ${primaryTextMaximumLength} characters.` });
  const callToAction = callsToAction.includes(input.callToAction as CallToAction) ? (input.callToAction as CallToAction) : "learn_more";
  if (type !== "carousel" && destination.type === "url" && (!destination.url || !isSafeHttpsUrl(destination.url))) issues.push({ path: `${path}.destination.url`, message: "Enter a full https:// website address." });
  const account = database.accounts.find((candidate) => candidate.id === accountId);
  if (type === "single" && account && (destination.type === "profile" || destination.type === "store") && !canMockAccountPromoteDestination(account, destination.type, destination.targetId)) issues.push({ path: `${path}.destination.targetId`, message: "You can only promote content you own or manage." });
  const normalised: CreativeInput = { type, mediaClickable: input.mediaClickable === true && type === "single", cards: type === "carousel" ? cards : [], app: type === "app_install" ? app : null, format, source: { type: sourceType, id: sourceId }, mediaIds, headline, primaryText, callToAction, destination };
  for (const [field, message] of Object.entries(validateCreativeTypeFields(normalised))) issues.push({ path: `${path}.${field}`, message });
  return normalised;
}

export function validateAdInputs(value: unknown, accountId: string, issues: Issues): AdInput[] {
  const inputs = Array.isArray(value) ? value : [];
  if (inputs.length === 0 || inputs.length > 6) issues.push({ path: "ads", message: "Add between 1 and 6 ads." });
  return inputs.slice(0, 6).map((input, index) => {
    const record = isRecord(input) ? input : {};
    const name = typeof record.name === "string" && record.name.trim() ? record.name.trim().slice(0, campaignNameMaximumLength) : `Ad ${index + 1}`;
    return { name, creative: validateCreativeInput(record.creative, `ads.${index}.creative`, accountId, issues) };
  });
}

export function throwIfValidationIssues(issues: Issues): void {
  if (issues.length > 0) throw new MockHttpError(400, "VALIDATION_FAILED", issues[0]?.message ?? "Validation failed", issues);
}

export function collectPlacementIssuesForAds(ads: readonly { readonly creative: Creative }[], placements: readonly AdPlacement[], issues: Issues): void {
  ads.forEach((ad, index) => {
    const shape = { creativeType: ad.creative.type, sourceType: ad.creative.source.type, media: ad.creative.type === "carousel" ? (ad.creative.cards ?? []).map((card) => card.media) : ad.creative.media, hasProduct: Boolean(ad.creative.product), hasLiveStream: Boolean(ad.creative.live) };
    const problem = describeWhyCreativeCannotRunAnywhere(shape, placements);
    if (problem) issues.push({ path: `ads.${index}.creative.placements`, message: problem });
  });
}
