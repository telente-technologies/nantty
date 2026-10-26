import type { MockPlatformUserRecord } from "@/mocks/seed/demoPlatformUsers.mock";
import type { UserRestriction, UserSession, UserStrike, UsernameHistoryEntry, UserWalletSummary } from "@/types/peopleUsers.type";

export interface MockUserExtras {
  bio: string | null;
  restriction: UserRestriction | null;
  wallet: UserWalletSummary;
  strikes: UserStrike[];
  sessions: UserSession[];
  usernameHistory: UsernameHistoryEntry[];
}

const strikeReasons: readonly { policy: string; reason: string; source: UserStrike["source"] }[] = [
  { policy: "Counterfeit goods", reason: "Listed replica designer bags as authentic.", source: "MODERATION" },
  { policy: "Copyright", reason: "Used a copyrighted Afrobeats track in 3 clips without a licence.", source: "COPYRIGHT" },
  { policy: "Misleading listings", reason: "Product photos did not match the item delivered.", source: "MODERATION" },
  { policy: "Impersonation", reason: "Posed as an official brand account to collect payments.", source: "MANUAL" },
];

const sessionTemplates: readonly Omit<UserSession, "id" | "startedAt" | "lastSeenAt">[] = [
  { device: "iPhone 15 Pro", platform: "IOS", ipAddress: "102.89.34.201", location: "Lagos, NG" },
  { device: "Tecno Camon 30", platform: "ANDROID", ipAddress: "105.112.18.77", location: "Abuja, NG" },
  { device: "Chrome on Windows", platform: "WEB", ipAddress: "197.210.54.9", location: "Ibadan, NG" },
];

const unitsPerMajorByCurrency: Record<string, number> = { NGN: 100, GHS: 100, KES: 100, ZAR: 100, GBP: 100, USD: 100 };
const typicalMajorBalanceByCurrency: Record<string, number> = { NGN: 184_500, GHS: 1_450, KES: 18_200, ZAR: 2_300, GBP: 140, USD: 160 };

function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function buildWalletForUser(user: MockPlatformUserRecord, index: number): UserWalletSummary {
  const units = unitsPerMajorByCurrency[user.currency] ?? 100;
  const typical = typicalMajorBalanceByCurrency[user.currency] ?? 150;
  const multiplier = user.isSeller ? 6 + (index % 5) : 1 + (index % 3) * 0.4;
  const money = (factor: number) => ({ amountMinor: Math.round(typical * multiplier * factor) * units, currency: user.currency });
  return {
    balances: [{ currency: user.currency, available: money(1), pending: money(0.18), inEscrow: user.isSeller ? money(0.65) : money(0) }],
    coinBalance: user.isCreator ? 12_400 + index * 310 : index * 45,
    pendingWithdrawalCount: user.isSeller || user.isCreator ? index % 3 : 0,
  };
}

function buildRestrictionForUser(user: MockPlatformUserRecord): UserRestriction | null {
  if (user.status === "SUSPENDED") return { kind: "SUSPENSION", reason: "Repeated counterfeit listings after two warnings.", startedAt: minutesAgoIso(42), endsAt: minutesAgoIso(-7 * 1440) };
  if (user.status === "BANNED") return { kind: "BAN", reason: "Impersonating Dangote Group to run a fake giveaway.", startedAt: minutesAgoIso(1600), endsAt: null };
  return null;
}

export function buildDemoUserExtras(users: readonly MockPlatformUserRecord[]): Map<string, MockUserExtras> {
  const extras = new Map<string, MockUserExtras>();
  users.forEach((user, index) => {
    const strikes: UserStrike[] = Array.from({ length: user.strikeCount }, (_, strikeIndex) => {
      const template = strikeReasons[(index + strikeIndex) % strikeReasons.length]!;
      return { id: `stk_${user.id}_${strikeIndex + 1}`, ...template, issuedAt: minutesAgoIso((strikeIndex + 1) * 9 * 1440), expiresAt: minutesAgoIso(-(90 - (strikeIndex + 1) * 9) * 1440), issuedByName: strikeIndex % 2 === 0 ? "Chidi Okafor" : "Automated moderation" };
    });
    const sessionCount = user.status === "BANNED" ? 0 : 1 + (index % 3);
    const sessions: UserSession[] = sessionTemplates.slice(0, sessionCount).map((template, sessionIndex) => ({ ...template, id: `uss_${user.id}_${sessionIndex + 1}`, startedAt: minutesAgoIso(4000 + sessionIndex * 900 + index * 13), lastSeenAt: minutesAgoIso(5 + sessionIndex * 180 + index * 7) }));
    const usernameHistory: UsernameHistoryEntry[] =
      index % 4 === 1
        ? [{ id: `unh_${user.id}_1`, fromUsername: `${user.username.replace(/[._]/g, "")}${2020 + (index % 5)}`, toUsername: user.username, kind: "USER_CHANGE", changedAt: minutesAgoIso(200 * 1440), changedByName: user.displayName, reason: null }]
        : [];
    extras.set(user.id, { bio: user.isSeller ? `${user.displayName} · shop on Nantty · delivery nationwide` : user.isCreator ? `${user.displayName} · creator · collabs in DM` : null, restriction: buildRestrictionForUser(user), wallet: buildWalletForUser(user, index), strikes, sessions, usernameHistory });
  });
  return extras;
}
