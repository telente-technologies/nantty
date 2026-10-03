import { freeRestoresPerMonth, hourglassThresholdSeconds, milestoneEveryDays, premiumRestoresPerMonth, restoreWindowMilliseconds } from "../../../constants/streak.constant.js";
import { addDaysToLabel, daysBetweenLabels, endOfLocalDay, localDayLabel, localMonthKey, secondsUntilLocalDayEnds } from "../../../utils/localDay.util.js";

export type StreakStateName = "none" | "active" | "broken";

export interface StreakSnapshot {
  readonly count: number;
  readonly state: StreakStateName;
  readonly lastCompletedDay: string | null;
  readonly countBeforeBreak: number;
  readonly brokenAt: Date | null;
  readonly restorableUntil: Date | null;
}

export interface StreakParticipants {
  readonly viewerTimeZone: string;
  readonly peerTimeZone: string;
}

export const emptyStreak: StreakSnapshot = { count: 0, state: "none", lastCompletedDay: null, countBeforeBreak: 0, brokenAt: null, restorableUntil: null };

export function slowestLocalDay(now: Date, participants: StreakParticipants): string {
  const mine = localDayLabel(now, participants.viewerTimeZone);
  const theirs = localDayLabel(now, participants.peerTimeZone);
  return mine < theirs ? mine : theirs;
}

export function evaluateStreakAt(snapshot: StreakSnapshot, now: Date, participants: StreakParticipants): StreakSnapshot {
  if (snapshot.state === "broken" && snapshot.restorableUntil !== null && now > snapshot.restorableUntil) {
    return { ...emptyStreak, lastCompletedDay: snapshot.lastCompletedDay };
  }
  if (snapshot.state !== "active" || snapshot.lastCompletedDay === null) return snapshot;
  const missedDay = addDaysToLabel(snapshot.lastCompletedDay, 1);
  if (daysBetweenLabels(snapshot.lastCompletedDay, slowestLocalDay(now, participants)) < 2) return snapshot;
  const viewerEnd = endOfLocalDay(missedDay, participants.viewerTimeZone);
  const peerEnd = endOfLocalDay(missedDay, participants.peerTimeZone);
  const brokenAt = viewerEnd > peerEnd ? viewerEnd : peerEnd;
  return { count: 0, state: "broken", lastCompletedDay: snapshot.lastCompletedDay, countBeforeBreak: snapshot.count, brokenAt, restorableUntil: new Date(brokenAt.getTime() + restoreWindowMilliseconds) };
}

export interface CompletionResult {
  readonly snapshot: StreakSnapshot;
  readonly milestoneReached: number | null;
}

export function completeStreakDay(snapshot: StreakSnapshot, completedDay: string, now: Date, participants: StreakParticipants): CompletionResult {
  const current = evaluateStreakAt(snapshot, now, participants);
  if (current.lastCompletedDay === completedDay && current.state === "active") return { snapshot: current, milestoneReached: null };
  const continues = current.state === "active" && current.lastCompletedDay !== null && daysBetweenLabels(current.lastCompletedDay, completedDay) === 1;
  const count = continues ? current.count + 1 : 1;
  const next: StreakSnapshot = { count, state: "active", lastCompletedDay: completedDay, countBeforeBreak: 0, brokenAt: null, restorableUntil: null };
  return { snapshot: next, milestoneReached: count % milestoneEveryDays === 0 ? count : null };
}

export function restoreBrokenStreak(snapshot: StreakSnapshot, now: Date, participants: StreakParticipants): StreakSnapshot {
  return { count: snapshot.countBeforeBreak, state: "active", lastCompletedDay: addDaysToLabel(slowestLocalDay(now, participants), -1), countBeforeBreak: 0, brokenAt: null, restorableUntil: null };
}

export function restoresAllowedPerMonth(isPremium: boolean): number {
  return isPremium ? premiumRestoresPerMonth : freeRestoresPerMonth;
}

export function currentRestoreMonthKey(now: Date, timeZone: string): string {
  return localMonthKey(now, timeZone);
}

export interface StreakViewInput {
  readonly snapshot: StreakSnapshot;
  readonly now: Date;
  readonly participants: StreakParticipants;
  readonly viewerSentToday: boolean;
  readonly peerSentToday: boolean;
  readonly restoresUsedThisMonth: number;
  readonly viewerIsPremium: boolean;
  readonly pendingCelebrationDays: number | null;
}

export interface StreakView {
  readonly count: number;
  readonly state: StreakStateName;
  readonly hourglass: boolean;
  readonly secondsUntilMyDayEnds: number;
  readonly sentToday: { readonly me: boolean; readonly peer: boolean };
  readonly restoresRemaining: number;
  readonly restoresPerMonth: number;
  readonly restorableUntil: string | null;
  readonly countBeforeBreak: number;
  readonly milestoneDays: number | null;
  readonly milestoneCelebrationPending: boolean;
}

export function buildStreakView(input: StreakViewInput): StreakView {
  const current = evaluateStreakAt(input.snapshot, input.now, input.participants);
  const secondsMine = secondsUntilLocalDayEnds(input.now, input.participants.viewerTimeZone);
  const secondsPeer = secondsUntilLocalDayEnds(input.now, input.participants.peerTimeZone);
  const myToday = localDayLabel(input.now, input.participants.viewerTimeZone);
  const peerToday = localDayLabel(input.now, input.participants.peerTimeZone);
  const lastCompleted = current.lastCompletedDay ?? "";
  const myDayOpen = lastCompleted < myToday && secondsMine <= hourglassThresholdSeconds;
  const peerDayOpen = lastCompleted < peerToday && secondsPeer <= hourglassThresholdSeconds;
  const perMonth = restoresAllowedPerMonth(input.viewerIsPremium);
  return {
    count: current.count,
    state: current.state,
    hourglass: current.state === "active" && (myDayOpen || peerDayOpen),
    secondsUntilMyDayEnds: secondsMine,
    sentToday: { me: input.viewerSentToday, peer: input.peerSentToday },
    restoresRemaining: Math.max(0, perMonth - input.restoresUsedThisMonth),
    restoresPerMonth: perMonth,
    restorableUntil: current.state === "broken" && current.restorableUntil !== null ? current.restorableUntil.toISOString() : null,
    countBeforeBreak: current.state === "broken" ? current.countBeforeBreak : 0,
    milestoneDays: input.pendingCelebrationDays,
    milestoneCelebrationPending: input.pendingCelebrationDays !== null,
  };
}
