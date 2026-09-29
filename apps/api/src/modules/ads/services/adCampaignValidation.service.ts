import type { ValidationIssue } from "../../../errors/ads.error.js";
import type { AdAccountRecord } from "../models/adAccounts.model.js";
import { ALL_AD_PLACEMENTS, type AdPlacement, type AudienceSpec, type BudgetLevel, type BudgetType, type CreativeInput } from "../models/adCampaigns.model.js";
import type { AdSetInputBody, CampaignInputBody, CreativeInputBody } from "../validators/adCampaigns.validator.js";

export const CAMPAIGN_NAME_MAXIMUM_LENGTH = 120;
export const HEADLINE_MAXIMUM_LENGTH = 60;
export const PRIMARY_TEXT_MAXIMUM_LENGTH = 500;
export const MINIMUM_DAILY_BUDGET_MINOR: Readonly<Record<string, number>> = { NGN: 100_000, GHS: 1_000, KES: 10_000, ZAR: 2_000, GBP: 100, EUR: 100, USD: 100 };

type MoneyBody = { readonly amountMinor: number; readonly currency: string };
type BudgetBody = { readonly type: BudgetType; readonly amount: MoneyBody } | null | undefined;
type ScheduleBody = { readonly startAt: string; readonly endAt?: string | null | undefined };

export interface ValidatedSchedule {
  readonly startAt: Date;
  readonly endAt: Date | null;
}

export interface ValidatedBudget {
  readonly budgetType: BudgetType | null;
  readonly budgetMinor: number | null;
}

function readMoney(money: MoneyBody, path: string, account: AdAccountRecord, issues: ValidationIssue[]): number {
  if (money.currency !== account.currency) issues.push({ path: `${path}.currency`, message: `Amounts must be in ${account.currency}, the ad account currency.` });
  if (money.amountMinor <= 0) issues.push({ path: `${path}.amountMinor`, message: "Enter an amount above zero." });
  return money.amountMinor;
}

export function validateSchedule(schedule: ScheduleBody, path: string, issues: ValidationIssue[]): ValidatedSchedule {
  const startAt = new Date(schedule.startAt);
  const endAt = schedule.endAt === null || schedule.endAt === undefined ? null : new Date(schedule.endAt);
  if (Number.isNaN(startAt.getTime())) issues.push({ path: `${path}.startAt`, message: "Choose a start date." });
  if (endAt !== null && Number.isNaN(endAt.getTime())) issues.push({ path: `${path}.endAt`, message: "Choose a valid end date." });
  if (endAt !== null && endAt.getTime() <= startAt.getTime()) issues.push({ path: `${path}.endAt`, message: "The end must be after the start." });
  return { startAt: Number.isNaN(startAt.getTime()) ? new Date(0) : startAt, endAt: endAt !== null && Number.isNaN(endAt.getTime()) ? null : endAt };
}

export function validateBudget(budget: BudgetBody, path: string, account: AdAccountRecord, schedule: ValidatedSchedule, issues: ValidationIssue[]): ValidatedBudget {
  if (budget === null || budget === undefined) return { budgetType: null, budgetMinor: null };
  const amount = readMoney(budget.amount, `${path}.amount`, account, issues);
  const minimumDaily = MINIMUM_DAILY_BUDGET_MINOR[account.currency] ?? 100;
  if (budget.type === "daily" && amount < minimumDaily) issues.push({ path: `${path}.amount`, message: "The daily budget is below the minimum for this currency." });
  if (budget.type === "lifetime" && schedule.endAt === null) issues.push({ path: `${path}.type`, message: "A lifetime budget needs an end date." });
  return { budgetType: budget.type, budgetMinor: amount };
}

export function validateCampaignInput(body: CampaignInputBody, account: AdAccountRecord, issues: ValidationIssue[]) {
  const name = body.name.trim();
  if (name.length === 0 || name.length > CAMPAIGN_NAME_MAXIMUM_LENGTH) issues.push({ path: "campaign.name", message: `Name the campaign (up to ${CAMPAIGN_NAME_MAXIMUM_LENGTH} characters).` });
  const schedule = validateSchedule(body.schedule, "campaign.schedule", issues);
  const budget = body.budgetLevel === "campaign" ? validateBudget(body.budget, "campaign.budget", account, schedule, issues) : { budgetType: null, budgetMinor: null };
  if (body.budgetLevel === "campaign" && budget.budgetMinor === null) issues.push({ path: "campaign.budget", message: "Set a campaign budget." });
  const spendCapMinor = body.spendCap === null || body.spendCap === undefined ? null : readMoney(body.spendCap, "campaign.spendCap", account, issues);
  return { name, objective: body.objective, budgetLevel: body.budgetLevel as BudgetLevel, ...budget, spendCapMinor, ...schedule };
}

export function validateAudience(audience: AudienceSpec, path: string, issues: ValidationIssue[]): AudienceSpec {
  if (audience.locations.length === 0) issues.push({ path: `${path}.locations`, message: "Add at least one country, state or city." });
  if (audience.ageMin < 18 || audience.ageMax > 65 || audience.ageMin > audience.ageMax) issues.push({ path: `${path}.ageMin`, message: "Ages must be between 18 and 65+, youngest first." });
  return audience;
}

export function validateAdSetInput(body: AdSetInputBody, account: AdAccountRecord, budgetLevel: BudgetLevel, issues: ValidationIssue[], prefix = "adSet") {
  const name = body.name.trim();
  if (name.length === 0 || name.length > CAMPAIGN_NAME_MAXIMUM_LENGTH) issues.push({ path: `${prefix}.name`, message: "Name the ad set." });
  const placements: readonly AdPlacement[] = body.placementMode === "automatic" ? ALL_AD_PLACEMENTS : [...new Set(body.placements)];
  if (body.placementMode === "manual" && placements.length === 0) issues.push({ path: `${prefix}.placements`, message: "Choose at least one placement." });
  const schedule = validateSchedule(body.schedule, `${prefix}.schedule`, issues);
  const budget = budgetLevel === "ad_set" ? validateBudget(body.budget, `${prefix}.budget`, account, schedule, issues) : { budgetType: null, budgetMinor: null };
  if (budgetLevel === "ad_set" && budget.budgetMinor === null) issues.push({ path: `${prefix}.budget`, message: "Set an ad set budget." });
  const bidAmount = body.bidStrategy.amount;
  let bidMinor: number | null = null;
  if (body.bidStrategy.type !== "auto") {
    if (bidAmount === null || bidAmount === undefined) issues.push({ path: `${prefix}.bidStrategy.amount`, message: "Enter a bid amount." });
    else bidMinor = readMoney(bidAmount, `${prefix}.bidStrategy.amount`, account, issues);
  }
  const cap = body.frequencyCap ?? null;
  if (cap !== null && (cap.impressions < 1 || cap.impressions > 20 || cap.perDays < 1 || cap.perDays > 30)) {
    issues.push({ path: `${prefix}.frequencyCap`, message: "Frequency cap must be 1–20 impressions per 1–30 days." });
  }
  return {
    name,
    audience: validateAudience(body.audience as AudienceSpec, `${prefix}.audience`, issues),
    placementMode: body.placementMode,
    placements,
    ...schedule,
    ...budget,
    bidType: body.bidStrategy.type,
    bidMinor,
    frequencyImpressions: cap?.impressions ?? null,
    frequencyDays: cap?.perDays ?? null,
    conversionEventId: body.conversionEventId ?? null,
  };
}

function isSafeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === "" && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function validateCreativeInput(body: CreativeInputBody, path: string, issues: ValidationIssue[]): CreativeInput {
  const headline = body.headline.trim();
  const primaryText = body.primaryText.trim();
  if (headline.length === 0 || headline.length > HEADLINE_MAXIMUM_LENGTH) issues.push({ path: `${path}.headline`, message: `Add a headline (up to ${HEADLINE_MAXIMUM_LENGTH} characters).` });
  if (primaryText.length > PRIMARY_TEXT_MAXIMUM_LENGTH) issues.push({ path: `${path}.primaryText`, message: `Primary text can be at most ${PRIMARY_TEXT_MAXIMUM_LENGTH} characters.` });
  const url = body.destination.url?.trim() ?? null;
  if (body.destination.type === "url" && (url === null || !isSafeHttpsUrl(url))) issues.push({ path: `${path}.destination.url`, message: "Enter a full https:// website address." });
  return {
    format: body.format,
    source: body.source,
    mediaIds: body.mediaIds,
    headline,
    primaryText,
    callToAction: body.callToAction,
    destination: { type: body.destination.type, targetId: body.destination.targetId ?? null, url: body.destination.type === "url" ? url : null },
  };
}
