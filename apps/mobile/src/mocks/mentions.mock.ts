import type { MentionCandidate, MentionPrivacySettings, MentionSurface, MentionTargetsByUserId } from "@/types/mention.type";

import { findMockConversation } from "./chats.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import {
  doesUserAllowMentionsFromAuthor,
  getGroupMentionContext,
  mentionPrivacyByUserId,
  recentlyInteractedUserIds,
  userIdsWhoBlockedTheAuthor,
} from "./mentionRules.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { followedUserIds } from "./socialGraph.mock";
import { directoryUsers, summariseUser } from "./userDirectory.mock";

const MAXIMUM_CANDIDATES = 15;
const EVERYONE_ADMIN_ONLY_REASON = "Only admins can @all in this group";

const rankOfUser = (userId: string, surface: MentionSurface): MentionCandidate["rank"] =>
  surface === "group" || surface === "direct" ? "member" : followedUserIds.has(userId) ? "following" : recentlyInteractedUserIds.includes(userId) ? "recent" : "other";

const rankOrder: Readonly<Record<MentionCandidate["rank"], number>> = { following: 0, recent: 1, member: 1, other: 2 };

const matchesTerm = (name: string, username: string, term: string) => !term || name.toLowerCase().includes(term) || username.toLowerCase().includes(term);

const listCandidates = (surface: MentionSurface, term: string, conversationId: string | null): MentionCandidate[] => {
  const author = getSignedInMockUser();
  const groupContext = surface === "group" && conversationId ? getGroupMentionContext(conversationId, author.id) : null;
  return directoryUsers
    .filter((user) => user.id !== author.id && user.account?.status === "active" && !userIdsWhoBlockedTheAuthor.has(user.id))
    .filter((user) => surface !== "group" || groupContext?.memberUserIds.includes(user.id))
    .filter((user) => surface !== "direct" || (!!conversationId && findMockConversation(conversationId).peer.id === user.id))
    .filter((user) => matchesTerm(user.name, user.username, term))
    .map((user) => ({ user: summariseUser(user), allowsMentions: doesUserAllowMentionsFromAuthor(user.id, author.id), rank: rankOfUser(user.id, surface) }))
    .sort((a, b) => rankOrder[a.rank] - rankOrder[b.rank])
    .slice(0, MAXIMUM_CANDIDATES);
};

const describeEveryoneOption = (surface: MentionSurface, term: string, conversationId: string | null) => {
  if (surface !== "group" || !conversationId || !"all".startsWith(term)) return null;
  const groupContext = getGroupMentionContext(conversationId, getSignedInMockUser().id);
  if (!groupContext) return null;
  const available = !groupContext.onlyAdminsCanMentionAll || groupContext.authorIsAdmin;
  return { available, unavailableReason: available ? null : EVERYONE_ADMIN_ONLY_REASON };
};

const resolveTargets = (userIds: readonly string[]): MentionTargetsByUserId =>
  Object.fromEntries(
    userIds.map((userId) => {
      const user = directoryUsers.find((candidate) => candidate.id === userId);
      if (!user) return [userId, { username: null, status: "deleted" as const }];
      return [userId, { username: user.username, status: user.account?.status === "suspended" ? ("suspended" as const) : ("active" as const) }];
    }),
  );

export const mentionsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/mentions/candidates", ({ query }) => {
    const surface = (query.get("surface") ?? "post") as MentionSurface;
    const term = (query.get("q") ?? "").trim().toLowerCase();
    const conversationId = query.get("conversationId");
    return { candidates: listCandidates(surface, term, conversationId), everyone: describeEveryoneOption(surface, term, conversationId) };
  }),
  createMockRoute("POST", "/api/v1/mentions/resolve", ({ body }) => resolveTargets((body as { userIds: string[] }).userIds ?? [])),
  createMockRoute("GET", "/api/v1/users/me/mention-privacy", (): MentionPrivacySettings => ({ whoCanMentionMe: mentionPrivacyByUserId.get(getSignedInMockUser().id) ?? "everyone" })),
  createMockRoute("PUT", "/api/v1/users/me/mention-privacy", ({ body }) => {
    const settings = body as MentionPrivacySettings;
    mentionPrivacyByUserId.set(getSignedInMockUser().id, settings.whoCanMentionMe);
    return settings;
  }),
];
