import { getVerifiedCardRules, millisecondsPerDay } from "@/constants/feedModules.constant";

export interface GetVerifiedCardHistory {
  readonly lastImpressionAt: number | null;
  readonly dismissalsSinceSnooze: number;
  readonly snoozedUntil: number | null;
  readonly neverShowAgain: boolean;
  readonly surfacedOfferIds: readonly string[];
}

export type GetVerifiedCardRules = typeof getVerifiedCardRules;

export const emptyGetVerifiedCardHistory: GetVerifiedCardHistory = { lastImpressionAt: null, dismissalsSinceSnooze: 0, snoozedUntil: null, neverShowAgain: false, surfacedOfferIds: [] };

const maximumRememberedOfferIds = 50;

export function canShowGetVerifiedCard(history: GetVerifiedCardHistory, now: number, rules: GetVerifiedCardRules = getVerifiedCardRules): boolean {
  if (history.neverShowAgain) return false;
  if (history.snoozedUntil !== null && now < history.snoozedUntil) return false;
  return history.lastImpressionAt === null || now - history.lastImpressionAt >= rules.impressionIntervalDays * millisecondsPerDay;
}

export function recordGetVerifiedCardImpression(history: GetVerifiedCardHistory, now: number): GetVerifiedCardHistory {
  return { ...history, lastImpressionAt: now };
}

export function recordGetVerifiedCardDismissal(history: GetVerifiedCardHistory, now: number, rules: GetVerifiedCardRules = getVerifiedCardRules): GetVerifiedCardHistory {
  const dismissals = history.dismissalsSinceSnooze + 1;
  if (dismissals >= rules.dismissalsBeforeSnooze) return { ...history, lastImpressionAt: now, dismissalsSinceSnooze: 0, snoozedUntil: now + rules.snoozeDays * millisecondsPerDay };
  return { ...history, lastImpressionAt: now, dismissalsSinceSnooze: dismissals };
}

export function recordGetVerifiedCardNeverAgain(history: GetVerifiedCardHistory): GetVerifiedCardHistory {
  return { ...history, neverShowAgain: true };
}

export function offerIdsNotYetSurfaced(history: GetVerifiedCardHistory, offerIds: readonly string[]): string[] {
  const surfaced = new Set(history.surfacedOfferIds);
  return offerIds.filter((offerId) => !surfaced.has(offerId));
}

export function recordOffersSurfaced(history: GetVerifiedCardHistory, offerIds: readonly string[]): GetVerifiedCardHistory {
  const merged = [...new Set([...history.surfacedOfferIds, ...offerIds])];
  return { ...history, surfacedOfferIds: merged.slice(-maximumRememberedOfferIds) };
}
