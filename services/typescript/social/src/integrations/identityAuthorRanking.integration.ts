import type { Logger } from "@zudojs/logger";

import type { AuthorRankingTier } from "../constants/ranking.constant.js";
import type { IdentityReadClient } from "../databases/identityRead.database.js";
import type { AuthorRankingDirectory, AuthorRankingProfile } from "../interfaces/authorRanking.interface.js";
import type { PremiumEntitlements } from "../interfaces/premiumEntitlements.interface.js";

const activeCheckmarkStatuses = ["verified", "grace"];
const tierRankByColor: Readonly<Record<string, AuthorRankingTier>> = { black: "black_official", gold: "gold_business", blue: "blue_verified" };
const tierStrength: Readonly<Record<AuthorRankingTier, number>> = { none: 0, blue_essential: 1, blue_verified: 2, premium: 3, gold_business: 4, black_official: 5 };
const premiumCacheMilliseconds = 10 * 60_000;
const maximumPremiumLookupsPerCall = 20;

export function resolveTierFromCheckmarkColors(colors: readonly string[], isPremium: boolean): AuthorRankingTier {
  let best: AuthorRankingTier = "none";
  for (const color of colors) {
    const tier = tierRankByColor[color] ?? "none";
    if (tierStrength[tier] > tierStrength[best]) best = tier;
  }
  return best === "blue_verified" && isPremium ? "premium" : best;
}

export function createIdentityAuthorRankingDirectory(client: IdentityReadClient, logger: Logger, premium?: PremiumEntitlements, now: () => number = Date.now): AuthorRankingDirectory {
  const premiumCache = new Map<string, { readonly value: boolean; readonly expiresAt: number }>();
  const warned = new Set<string>();
  const warnOnce = (key: string, error: unknown) => {
    if (warned.has(key)) return;
    warned.add(key);
    logger.warn(`author ranking read failed (${key}); falling back to no boost`, { error: error instanceof Error ? error.message : String(error) });
  };
  const readPremium = async (accountIds: readonly string[]): Promise<ReadonlySet<string>> => {
    if (premium === undefined) return new Set();
    const result = new Set<string>();
    let lookups = 0;
    for (const accountId of accountIds) {
      const cached = premiumCache.get(accountId);
      if (cached !== undefined && cached.expiresAt > now()) {
        if (cached.value) result.add(accountId);
        continue;
      }
      if (lookups >= maximumPremiumLookupsPerCall) continue;
      lookups += 1;
      const value = await premium.isPremium(accountId).catch(() => false);
      premiumCache.set(accountId, { value, expiresAt: now() + premiumCacheMilliseconds });
      if (value) result.add(accountId);
    }
    return result;
  };
  return {
    async findAuthorRankingProfiles(accountIds) {
      const unique = [...new Set(accountIds)];
      const result = new Map<string, AuthorRankingProfile>();
      if (unique.length === 0) return result;
      const [checkmarks, adminCreated, profiles] = await Promise.all([
        client.identityProfileCheckmark.findMany({ where: { accountId: { in: unique }, status: { in: activeCheckmarkStatuses } }, select: { accountId: true, color: true } }).catch((error: unknown) => (warnOnce("profile_checkmarks", error), [])),
        client.identityAdminCreatedAccount.findMany({ where: { accountId: { in: unique } }, select: { accountId: true } }).catch((error: unknown) => (warnOnce("admin_created_accounts", error), [])),
        client.identityProfile.findMany({ where: { accountId: { in: unique }, kind: "personal" }, select: { accountId: true, countryCode: true } }).catch((error: unknown) => (warnOnce("profiles.country_code", error), [])),
      ]);
      const colorsByAccount = new Map<string, string[]>();
      for (const row of checkmarks) colorsByAccount.set(row.accountId, [...(colorsByAccount.get(row.accountId) ?? []), row.color]);
      const blueAccounts = [...colorsByAccount].filter(([, colors]) => colors.includes("blue") && !colors.includes("gold") && !colors.includes("black")).map(([accountId]) => accountId);
      const premiumAccounts = await readPremium(blueAccounts);
      const adminCreatedIds = new Set(adminCreated.map((row) => row.accountId));
      const countryByAccount = new Map(profiles.map((row) => [row.accountId, row.countryCode ?? null]));
      for (const accountId of unique) {
        const tier = resolveTierFromCheckmarkColors(colorsByAccount.get(accountId) ?? [], premiumAccounts.has(accountId));
        result.set(accountId, { tier, isOfficial: tier !== "none" && adminCreatedIds.has(accountId), countryCode: countryByAccount.get(accountId) ?? null });
      }
      return result;
    },

    async findAccountCreatedDates(accountIds) {
      const unique = [...new Set(accountIds)];
      if (unique.length === 0) return new Map();
      const rows = await client.identityAccount.findMany({ where: { id: { in: unique } }, select: { id: true, createdAt: true } }).catch((error: unknown) => (warnOnce("accounts.created_at", error), []));
      return new Map(rows.map((row) => [row.id, row.createdAt]));
    },

    async findSuspendedAccountIds(accountIds) {
      const unique = [...new Set(accountIds)];
      if (unique.length === 0) return new Set();
      const rows = await client.identityAccountSuspension.findMany({ where: { accountId: { in: unique }, status: "active" }, select: { accountId: true } }).catch((error: unknown) => (warnOnce("account_suspensions", error), []));
      return new Set(rows.map((row) => row.accountId));
    },
  };
}

export const noAuthorRankingDirectory: AuthorRankingDirectory = {
  findAuthorRankingProfiles: async (accountIds) => new Map(accountIds.map((accountId) => [accountId, { tier: "none", isOfficial: false, countryCode: null }])),
  findAccountCreatedDates: async () => new Map(),
  findSuspendedAccountIds: async () => new Set(),
};
