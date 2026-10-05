import type { UserSummary } from "../../../interfaces/identityDirectory.interface.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { followRepository } from "../../follows/repositories/follow.repository.js";
import { buildStreakViewForViewer } from "../../streaks/services/streakTracking.service.js";
import type { ConversationView, MemberRoleName } from "../models/conversation.model.js";
import type { MemberWithConversation } from "../repositories/conversation.repository.js";

function groupPseudoPeer(conversationId: string, title: string | null): UserSummary {
  return { id: conversationId, name: title ?? "", username: "", avatarUrl: null, verified: false, isCreator: false };
}

export function resolveMutedUntil(member: { readonly mutedAlways: boolean; readonly mutedUntil: Date | null }, now: Date): string | null {
  if (member.mutedAlways) return "always";
  return member.mutedUntil !== null && member.mutedUntil > now ? member.mutedUntil.toISOString() : null;
}

export async function buildConversationViews(context: HandlerContext, viewerId: string, rows: readonly MemberWithConversation[]): Promise<ConversationView[]> {
  if (rows.length === 0) return [];
  const db = context.database.client;
  const now = context.clock.now();
  const peerIdByConversation = new Map<string, string>();
  for (const row of rows) {
    if (row.conversation.kind !== "direct") continue;
    const peer = row.conversation.members.find((member) => member.accountId !== viewerId);
    if (peer !== undefined) peerIdByConversation.set(row.conversationId, peer.accountId);
  }
  const peerIds = [...new Set(peerIdByConversation.values())];
  const [summaries, followedByViewer, followingViewer] = await Promise.all([
    context.directory.findUserSummaries(peerIds),
    followRepository.followedAccountIds(db, viewerId, peerIds),
    Promise.all(peerIds.map(async (peerId) => ((await followRepository.find(db, peerId, viewerId))?.state === "accepted" ? peerId : undefined))),
  ]);
  const followers = new Set(followingViewer.filter((id): id is string => id !== undefined));
  const views: ConversationView[] = [];
  for (const row of rows) {
    const conversation = row.conversation;
    const peerId = peerIdByConversation.get(conversation.id);
    const peerSummary = peerId === undefined ? undefined : summaries.get(peerId);
    if (conversation.kind === "direct" && peerSummary === undefined) continue;
    const streak = peerId !== undefined && row.inboxFolder === "chats" ? await buildStreakViewForViewer(context, conversation.id, viewerId, peerId) : null;
    views.push({
      id: conversation.id,
      peer: peerSummary ?? groupPseudoPeer(conversation.id, conversation.title),
      lastMessage: "",
      lastMessageKind: conversation.lastMessageKind,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      unread: row.unreadCount,
      isFriend: peerId !== undefined && followedByViewer.has(peerId) && followers.has(peerId),
      kind: conversation.kind,
      title: conversation.title,
      description: conversation.description,
      photoUrl: null,
      photoMediaId: conversation.photoMediaId,
      memberCount: conversation.members.length,
      myRole: row.role as MemberRoleName,
      disappearingMessagesSeconds: conversation.disappearingMessagesSeconds,
      onlyAdminsCanMentionAll: conversation.onlyAdminsCanMentionAll,
      store: null,
      inboxFolder: row.inboxFolder,
      spamReason: row.spamReason,
      streak,
      mutedUntil: resolveMutedUntil(row, now),
    });
  }
  return views;
}
