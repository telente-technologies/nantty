import { ApiError } from "@/errors/api.error";
import type { ChatStreak } from "@/types";

import { getSignedInMockUser } from "./fixtures.mock";

const SECONDS_PER_DAY = 86_400;
const HOURGLASS_WARNING_SECONDS = 4 * 3_600;
const RESTORE_WINDOW_MS = 48 * 3_600_000;
const FREE_RESTORES_PER_MONTH = 3;
const PREMIUM_RESTORES_PER_MONTH = 6;
const MILESTONE_EVERY_DAYS = 100;
const DEFAULT_TIMEZONE = "Africa/Lagos";

export const savedTimezoneByUserId: Record<string, string> = {
  u_me: "Africa/Lagos",
  u_buyer: "Africa/Lagos",
  u_21: "Africa/Lagos",
  u_7: "America/New_York",
  u_1: "Europe/London",
};

const timezoneOf = (userId: string) => savedTimezoneByUserId[userId] ?? DEFAULT_TIMEZONE;

interface LocalClock {
  readonly dayKey: string;
  readonly monthKey: string;
  readonly secondsSinceMidnight: number;
}

const readLocalClock = (now: number, timezone: string): LocalClock => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(now))
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return {
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    monthKey: `${parts.year}-${parts.month}`,
    secondsSinceMidnight: Number(parts.hour) * 3_600 + Number(parts.minute) * 60 + Number(parts.second),
  };
};

const dayNumber = (dayKey: string) => {
  const [year, month, day] = dayKey.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!) / (SECONDS_PER_DAY * 1000);
};

const shiftDayKey = (dayKey: string, days: number) => new Date((dayNumber(dayKey) + days) * SECONDS_PER_DAY * 1000).toISOString().slice(0, 10);

interface StreakRecord {
  count: number;
  countedMyDay: string | null;
  mySentDay: string | null;
  peerSentDay: string | null;
  brokenAt: number | null;
  countBeforeBreak: number;
  celebrationPending: boolean;
}

const records = new Map<string, StreakRecord>();
const restoresUsedByUserAndMonth = new Map<string, number>();
const peerIdByConversationId = new Map<string, string>();

export const seedStreak = (conversationId: string, peerId: string, seed: { count: number; daysSinceCounted: number; peerSentToday: boolean; mySentToday?: boolean }) => {
  const myToday = readLocalClock(Date.now(), timezoneOf(getSignedInMockUser().id)).dayKey;
  const peerToday = readLocalClock(Date.now(), timezoneOf(peerId)).dayKey;
  peerIdByConversationId.set(conversationId, peerId);
  records.set(conversationId, {
    count: seed.count,
    countedMyDay: shiftDayKey(myToday, -seed.daysSinceCounted),
    mySentDay: seed.mySentToday ? myToday : null,
    peerSentDay: seed.peerSentToday ? peerToday : null,
    brokenAt: null,
    countBeforeBreak: 0,
    celebrationPending: false,
  });
};

export const conversationHasStreak = (conversationId: string) => records.has(conversationId);

const settleBreak = (record: StreakRecord, now: number, myClock: LocalClock) => {
  if (record.brokenAt !== null || record.count === 0 || !record.countedMyDay) return;
  const daysSinceCounted = dayNumber(myClock.dayKey) - dayNumber(record.countedMyDay);
  if (daysSinceCounted <= 1) return;
  record.brokenAt = now - myClock.secondsSinceMidnight * 1000 - (daysSinceCounted - 2) * SECONDS_PER_DAY * 1000;
  record.countBeforeBreak = record.count;
  record.count = 0;
};

const restoresPerMonthForViewer = () => (getSignedInMockUser().verification?.tier === "PREMIUM" ? PREMIUM_RESTORES_PER_MONTH : FREE_RESTORES_PER_MONTH);

const clocksFor = (conversationId: string, now: number) => {
  const myId = getSignedInMockUser().id;
  const peerId = peerIdByConversationId.get(conversationId)!;
  return { myId, myClock: readLocalClock(now, timezoneOf(myId)), peerClock: readLocalClock(now, timezoneOf(peerId)) };
};

export const readStreakForViewer = (conversationId: string, now = Date.now()): ChatStreak | null => {
  const record = records.get(conversationId);
  if (!record) return null;
  const { myId, myClock, peerClock } = clocksFor(conversationId, now);
  settleBreak(record, now, myClock);
  const sentToday = { me: record.mySentDay === myClock.dayKey, peer: record.peerSentDay === peerClock.dayKey };
  const secondsUntilMyDayEnds = SECONDS_PER_DAY - myClock.secondsSinceMidnight;
  const restoresPerMonth = restoresPerMonthForViewer();
  const restoreWindowOpen = record.brokenAt !== null && now - record.brokenAt <= RESTORE_WINDOW_MS;
  const state = record.count > 0 ? "active" : record.brokenAt !== null ? "broken" : "none";
  return {
    count: record.count,
    state,
    hourglass: state === "active" && record.countedMyDay !== myClock.dayKey && secondsUntilMyDayEnds <= HOURGLASS_WARNING_SECONDS,
    secondsUntilMyDayEnds,
    sentToday,
    restoresPerMonth,
    restoresRemaining: Math.max(0, restoresPerMonth - (restoresUsedByUserAndMonth.get(`${myId}|${myClock.monthKey}`) ?? 0)),
    restorableUntil: restoreWindowOpen ? new Date(record.brokenAt! + RESTORE_WINDOW_MS).toISOString() : null,
    countBeforeBreak: record.countBeforeBreak,
    milestoneDays: record.count >= MILESTONE_EVERY_DAYS ? Math.floor(record.count / MILESTONE_EVERY_DAYS) * MILESTONE_EVERY_DAYS : null,
    milestoneCelebrationPending: record.celebrationPending,
  };
};

export const recordStreakSendByMe = (conversationId: string, now = Date.now()) => {
  const record = records.get(conversationId);
  if (!record) return;
  const { myClock, peerClock } = clocksFor(conversationId, now);
  settleBreak(record, now, myClock);
  record.mySentDay = myClock.dayKey;
  const bothSentToday = record.peerSentDay === peerClock.dayKey;
  if (!bothSentToday || record.countedMyDay === myClock.dayKey) return;
  record.count += 1;
  record.countedMyDay = myClock.dayKey;
  if (record.count % MILESTONE_EVERY_DAYS === 0) record.celebrationPending = true;
};

export const restoreStreakForViewer = (conversationId: string, now = Date.now()): ChatStreak => {
  const record = records.get(conversationId);
  if (!record) throw new ApiError(404, "No streak in this chat");
  const { myId, myClock } = clocksFor(conversationId, now);
  settleBreak(record, now, myClock);
  const usedKey = `${myId}|${myClock.monthKey}`;
  const used = restoresUsedByUserAndMonth.get(usedKey) ?? 0;
  if (record.brokenAt === null || now - record.brokenAt > RESTORE_WINDOW_MS) throw new ApiError(409, "This streak can no longer be restored");
  if (used >= restoresPerMonthForViewer()) throw new ApiError(403, "No restores left this month");
  restoresUsedByUserAndMonth.set(usedKey, used + 1);
  record.count = record.countBeforeBreak;
  record.brokenAt = null;
  record.countedMyDay = shiftDayKey(myClock.dayKey, -1);
  return readStreakForViewer(conversationId, now)!;
};

export const acknowledgeStreakCelebration = (conversationId: string) => {
  const record = records.get(conversationId);
  if (record) record.celebrationPending = false;
};
