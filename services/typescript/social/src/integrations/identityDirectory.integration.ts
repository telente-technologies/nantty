import type { Logger } from "@zudojs/logger";

import type { IdentityReadClient } from "../databases/identityRead.database.js";
import type { CheckmarkColor, IdentityDirectory, MentionTargetStatus, UserSummary, WhoCanMentionMe } from "../interfaces/identityDirectory.interface.js";

interface ProfileRow {
  readonly id?: string;
  readonly accountId: string;
  readonly handle: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly verified: boolean;
  readonly creatorStatus: string;
}

const profileSelect = { id: true, accountId: true, handle: true, displayName: true, avatarUrl: true, verified: true, creatorStatus: true } as const;

function toUserSummary(row: ProfileRow): UserSummary {
  return { id: row.accountId, name: row.displayName === "" ? row.handle : row.displayName, username: row.handle, avatarUrl: row.avatarUrl, verified: row.verified, isCreator: row.creatorStatus === "approved" };
}

export function createIdentityDirectory(client: IdentityReadClient, logger: Logger): IdentityDirectory {
  let mentionPrivacyUnavailableLogged = false;
  const personalProfiles = (accountIds: readonly string[]) =>
    client.identityProfile.findMany({ where: { accountId: { in: [...accountIds] }, kind: "personal" }, select: profileSelect });

  return {
    async findUserSummaries(accountIds) {
      if (accountIds.length === 0) return new Map();
      const rows = await personalProfiles([...new Set(accountIds)]);
      return new Map(rows.map((row) => [row.accountId, toUserSummary(row)]));
    },

    async findAccountIdsByUsernames(usernames) {
      if (usernames.length === 0) return new Map();
      const rows = await client.identityProfile.findMany({
        where: { handle: { in: usernames.map((username) => username.toLowerCase()) }, kind: "personal" },
        select: { accountId: true, handle: true },
      });
      return new Map(rows.map((row) => [row.handle.toLowerCase(), row.accountId]));
    },

    async searchUserSummaries(term, limit) {
      const needle = term.trim();
      if (needle === "") return [];
      const rows = await client.identityProfile.findMany({
        where: { kind: "personal", status: "active", OR: [{ handle: { contains: needle, mode: "insensitive" } }, { displayName: { contains: needle, mode: "insensitive" } }] },
        select: profileSelect,
        orderBy: { handle: "asc" },
        take: limit,
      });
      return rows.map(toUserSummary);
    },

    async findPrivateAccountIds(accountIds) {
      if (accountIds.length === 0) return new Set();
      const rows = await client.identityProfile.findMany({ where: { accountId: { in: [...new Set(accountIds)] }, kind: "personal", isPrivate: true }, select: { accountId: true } });
      return new Set(rows.map((row) => row.accountId));
    },

    async findMentionPrivacy(accountIds) {
      const result = new Map<string, WhoCanMentionMe>();
      if (accountIds.length === 0) return result;
      try {
        const rows = await client.identityPrivacySetting.findMany({ where: { accountId: { in: [...new Set(accountIds)] } }, select: { accountId: true, whoCanMentionMe: true } });
        for (const row of rows) if (row.whoCanMentionMe === "following" || row.whoCanMentionMe === "no_one") result.set(row.accountId, row.whoCanMentionMe);
      } catch (error) {
        if (!mentionPrivacyUnavailableLogged) {
          mentionPrivacyUnavailableLogged = true;
          logger.warn("mention privacy is unreadable: grant SELECT (who_can_mention_me) on users.privacy_settings to zudomart_readers", { error: error instanceof Error ? error.message : String(error) });
        }
      }
      return result;
    },

    async findMentionTargetStatuses(accountIds) {
      const result = new Map<string, { username: string | null; status: MentionTargetStatus }>();
      const unique = [...new Set(accountIds)];
      if (unique.length === 0) return result;
      const [profiles, suspensions] = await Promise.all([
        personalProfiles(unique),
        client.identityAccountSuspension.findMany({ where: { accountId: { in: unique }, status: "active" }, select: { accountId: true } }),
      ]);
      const suspended = new Set(suspensions.map((row) => row.accountId));
      for (const accountId of unique) result.set(accountId, { username: null, status: "deleted" });
      for (const profile of profiles) result.set(profile.accountId, { username: profile.handle, status: suspended.has(profile.accountId) ? "suspended" : "active" });
      return result;
    },

    async hasPersonalizationConsent(accountId) {
      const row = await client.identityPrivacySetting.findUnique({ where: { accountId }, select: { personalization: true } });
      return row?.personalization ?? false;
    },

    async findAccountsAllowingPersonalizedAds(accountIds) {
      if (accountIds.length === 0) return new Set<string>();
      const rows = await client.identityPrivacySetting.findMany({ where: { accountId: { in: [...accountIds] }, personalizedAds: true }, select: { accountId: true } });
      return new Set(rows.map((row) => row.accountId));
    },

    async findCheckmarkColors(accountIds) {
      const result = new Map<string, CheckmarkColor>();
      if (accountIds.length === 0) return result;
      const profiles = await personalProfiles([...new Set(accountIds)]);
      const rows = await client.identityProfileCheckmark.findMany({ where: { profileId: { in: profiles.map((profile) => profile.id) }, status: { in: ["verified", "grace"] } }, select: { accountId: true, color: true } });
      for (const row of rows) if (row.color === "blue" || row.color === "gold" || row.color === "black") result.set(row.accountId, row.color);
      return result;
    },

    async findAccountCreatedAt(accountId) {
      const row = await client.identityAccount.findUnique({ where: { id: accountId }, select: { createdAt: true } });
      return row?.createdAt;
    },

    async findOwnedPostableProfile(accountId, profileId, purpose = "manage") {
      const row = await client.identityProfile.findFirst({
        where: { id: profileId, accountId, status: "active", ...(purpose === "publish" ? { publishingHeld: false } : {}), kind: { in: ["personal", "business", "brand", "store"] } },
        select: { id: true, accountId: true, kind: true, displayName: true, handle: true, avatarUrl: true },
      });
      return row === null ? null : { id: row.id, accountId: row.accountId, kind: row.kind, displayName: row.displayName, handle: row.handle, avatarUrl: row.avatarUrl };
    },

    async findProfilesByIds(profileIds) {
      const unique = [...new Set(profileIds)];
      if (unique.length === 0) return new Map();
      const rows = await client.identityProfile.findMany({
        where: { id: { in: unique }, status: "active" },
        select: { id: true, accountId: true, kind: true, displayName: true, handle: true, avatarUrl: true },
      });
      return new Map(rows.map((row) => [row.id, { id: row.id, accountId: row.accountId, kind: row.kind, displayName: row.displayName, handle: row.handle, avatarUrl: row.avatarUrl }]));
    },
  };
}
