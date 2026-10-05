import type { UserSummary } from "../../../../interfaces/identityDirectory.interface.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import { requireConversationMember } from "../../../conversations/services/conversationAccess.service.js";
import { followRepository } from "../../../follows/repositories/follow.repository.js";
import type { ListMentionCandidatesQuery } from "./listMentionCandidates.query.js";

type CandidateRank = "following" | "follower" | "recent" | "other" | "member";

export interface MentionCandidatesResponse {
  readonly candidates: readonly { readonly user: UserSummary; readonly allowsMentions: boolean; readonly rank: CandidateRank }[];
  readonly everyone: { readonly available: boolean; readonly unavailableReason: string | null } | null;
}

const maximumCandidates = 20;

export function createListMentionCandidatesHandler(context: HandlerContext): Handler<ListMentionCandidatesQuery, MentionCandidatesResponse> {
  return async ({ viewerId, surface, term, conversationId }) => {
    const db = context.database.client;
    const needle = term.trim().toLowerCase();
    const matches = (user: UserSummary) => needle === "" || user.username.toLowerCase().includes(needle) || user.name.toLowerCase().includes(needle);
    const ranked = new Map<string, { user: UserSummary; rank: CandidateRank }>();
    let everyone: MentionCandidatesResponse["everyone"] = null;
    if (surface === "group" || surface === "direct") {
      if (conversationId === undefined) return { candidates: [], everyone: null };
      const access = await requireConversationMember(db, conversationId, viewerId);
      const canAll = !access.conversation.onlyAdminsCanMentionAll || access.member.role === "owner" || access.member.role === "admin";
      everyone = surface === "direct" || access.conversation.kind === "direct" ? null : { available: canAll, unavailableReason: canAll ? null : "Only admins can mention everyone" };
      const members = await context.directory.findUserSummaries(access.conversation.members.map((member) => member.accountId));
      for (const [id, user] of members) if (id !== viewerId && matches(user)) ranked.set(id, { user, rank: "member" });
    } else {
      const followedIds = await followRepository.allFollowedAccountIds(db, viewerId, 200);
      const followed = await context.directory.findUserSummaries(followedIds);
      for (const [id, user] of followed) if (matches(user)) ranked.set(id, { user, rank: "following" });
      if (needle !== "") for (const user of await context.directory.searchUserSummaries(needle, maximumCandidates * 2)) if (!ranked.has(user.id)) ranked.set(user.id, { user, rank: "other" });
    }
    ranked.delete(viewerId);
    const ids = [...ranked.keys()];
    const [blockedEitherWay, privacy, statuses] = await Promise.all([blockRepository.everyoneBlockedByOrBlocking(db, viewerId), context.directory.findMentionPrivacy(ids), context.directory.findMentionTargetStatuses(ids)]);
    const followersOfViewer = new Set((await Promise.all(ids.map(async (id) => ((await followRepository.find(db, id, viewerId))?.state === "accepted" ? id : undefined)))).filter((id): id is string => id !== undefined));
    const candidates = [...ranked.entries()]
      .filter(([id]) => !blockedEitherWay.has(id) && statuses.get(id)?.status === "active")
      .map(([id, entry]) => {
        const setting = privacy.get(id) ?? "everyone";
        const allows = setting === "everyone" || (setting === "following" && followersOfViewer.has(id));
        return { user: entry.user, allowsMentions: allows, rank: entry.rank === "other" && followersOfViewer.has(id) ? ("follower" as const) : entry.rank };
      })
      .slice(0, maximumCandidates);
    return { candidates, everyone };
  };
}
