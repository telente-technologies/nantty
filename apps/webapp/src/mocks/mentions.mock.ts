import { ApiError } from "@/errors/api.error";
import type { MentionCandidate, MentionCandidatesResponse, MentionEntity, ResolvedMentionUser, WhoCanMentionMe } from "@/types";
import { maximumMentionsPerText } from "@/types/mentions.type";

import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { blockedUserIds, followedUserIds } from "./socialGraph.mock";
import { directoryUsers, directoryUsersExcludingAccounts, summariseUser } from "./userDirectory.mock";

const whoCanMentionMeByUserId = new Map<string, WhoCanMentionMe>([
  ["u_11", "no_one"],
  ["u_8", "following"],
]);
const userIdsWhoBlockedTheViewer = new Set<string>(["u_24"]);
const usersTheTargetFollowsByTarget: Readonly<Record<string, readonly string[]>> = { u_8: ["u_me"] };
const suspendedUserIds = new Set<string>(["u_gov"]);
const recentlyInteractedUserIds = new Set<string>(["u_10", "u_21", "u_13"]);

const isUserAllowedToBeMentionedByViewer = (userId: string): boolean => {
  const viewerId = getSignedInMockUser().id;
  const setting = whoCanMentionMeByUserId.get(userId) ?? "everyone";
  if (setting === "no_one") return false;
  if (setting === "following") return (usersTheTargetFollowsByTarget[userId] ?? []).includes(viewerId);
  return true;
};

const isMentionableAtAll = (userId: string) => !userIdsWhoBlockedTheViewer.has(userId) && !suspendedUserIds.has(userId) && userId !== getSignedInMockUser().id;

export function keepAllowedMentionEntities(text: string, mentions: unknown): MentionEntity[] {
  if (!Array.isArray(mentions)) return [];
  if (mentions.length > maximumMentionsPerText) throw new ApiError(422, `You can mention up to ${maximumMentionsPerText} people`, "TOO_MANY_MENTIONS");
  const kept: MentionEntity[] = [];
  for (const entry of mentions as Partial<{ userId: string; username: string; type: string; start: number; length: number }>[]) {
    if (!Number.isInteger(entry.start) || !Number.isInteger(entry.length) || entry.start! < 0 || entry.start! + entry.length! > text.length || text[entry.start!] !== "@") continue;
    if (kept.some((existing) => entry.start! < existing.start + existing.length && existing.start < entry.start! + entry.length!)) continue;
    if (typeof entry.userId !== "string" || typeof entry.username !== "string") continue;
    if (!isMentionableAtAll(entry.userId) || !isUserAllowedToBeMentionedByViewer(entry.userId)) continue;
    kept.push({ userId: entry.userId, username: entry.username, start: entry.start!, length: entry.length! });
  }
  return kept;
}

const rankOf = (userId: string): MentionCandidate["rank"] => (followedUserIds.has(userId) ? "following" : recentlyInteractedUserIds.has(userId) ? "recent" : "other");
const rankOrder = { following: 0, recent: 1, other: 2, member: 3 } as const;

const listMentionCandidates = (query: string): MentionCandidatesResponse => {
  const normalisedQuery = query.trim().toLowerCase();
  const candidates = directoryUsersExcludingAccounts
    .filter((user) => isMentionableAtAll(user.id) && !blockedUserIds.has(user.id))
    .filter((user) => !normalisedQuery || user.username.toLowerCase().startsWith(normalisedQuery) || user.name.toLowerCase().includes(normalisedQuery))
    .map((user) => ({ user: summariseUser(user), allowsMentions: isUserAllowedToBeMentionedByViewer(user.id), rank: rankOf(user.id) }))
    .sort((first, second) => rankOrder[first.rank] - rankOrder[second.rank])
    .slice(0, 8);
  return { candidates, everyone: null };
};

const resolveMentionedUsers = (userIds: unknown): Record<string, ResolvedMentionUser> => {
  const ids = Array.isArray(userIds) ? userIds.filter((id): id is string => typeof id === "string").slice(0, 100) : [];
  return Object.fromEntries(
    ids.map((userId) => {
      const user = directoryUsers.find((candidate) => candidate.id === userId);
      if (!user) return [userId, { username: null, status: "deleted" as const }];
      return [userId, { username: user.username, status: suspendedUserIds.has(userId) ? ("suspended" as const) : ("active" as const) }];
    }),
  );
};

export const mentionsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/mentions/candidates", ({ query }) => listMentionCandidates(query.get("q") ?? "")),
  createMockRoute("POST", "/api/v1/mentions/resolve", ({ body }) => resolveMentionedUsers((body as { userIds?: unknown })?.userIds)),
  createMockRoute("GET", "/api/v1/users/me/mention-privacy", () => ({ whoCanMentionMe: whoCanMentionMeByUserId.get(getSignedInMockUser().id) ?? "everyone" })),
  createMockRoute("PUT", "/api/v1/users/me/mention-privacy", ({ body }) => {
    const setting = (body as { whoCanMentionMe?: unknown })?.whoCanMentionMe;
    if (setting !== "everyone" && setting !== "following" && setting !== "no_one") throw new ApiError(422, "Choose who can mention you");
    whoCanMentionMeByUserId.set(getSignedInMockUser().id, setting);
    return { whoCanMentionMe: setting };
  }),
];
