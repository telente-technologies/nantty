import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { followRepository } from "../../../follows/repositories/follow.repository.js";
import type { ListDigestPageQuery } from "./listDigestPage.query.js";
import { publishedPostToViewers } from "../../../../constants/moderation.constant.js";

export interface DigestEntry {
  readonly userId: string;
  readonly props: Readonly<Record<string, unknown>>;
}

export interface DigestPage {
  readonly data: readonly DigestEntry[];
  readonly nextCursor: string | null;
}

const sampleSize = 3;

export function createListDigestPageHandler(context: HandlerContext): Handler<ListDigestPageQuery, DigestPage> {
  return async (query) => {
    if (query.kind === "followRequests") return followRequestDigests(context, query);
    if (query.kind === "messageRequests") return messageRequestDigests(context, query);
    return weeklyDigests(context, query);
  };
}

async function followRequestDigests(context: HandlerContext, query: ListDigestPageQuery): Promise<DigestPage> {
  const db = context.database.client;
  const groups = await db.follow.groupBy({ by: ["followeeId"], where: { state: "requested", ...(query.cursor === undefined ? {} : { followeeId: { gt: query.cursor } }) }, _count: { _all: true }, orderBy: { followeeId: "asc" }, take: query.limit });
  const data: DigestEntry[] = [];
  for (const group of groups) {
    const recent = await db.follow.findMany({ where: { followeeId: group.followeeId, state: "requested", createdAt: { gte: query.since } }, orderBy: { id: "desc" }, take: sampleSize });
    if (recent.length === 0) continue;
    const people = await context.directory.findUserSummaries(recent.map((row) => row.followerId));
    const requests = recent.flatMap((row) => { const person = people.get(row.followerId); return person === undefined ? [] : [{ name: person.name, handle: person.username }]; });
    data.push({ userId: group.followeeId, props: { requests, totalPending: group._count._all } });
  }
  return { data, nextCursor: groups.length === query.limit ? (groups.at(-1)?.followeeId ?? null) : null };
}

async function messageRequestDigests(context: HandlerContext, query: ListDigestPageQuery): Promise<DigestPage> {
  const db = context.database.client;
  const groups = await db.conversationMember.groupBy({ by: ["accountId"], where: { inboxFolder: "requests", leftAt: null, unreadCount: { gt: 0 }, ...(query.cursor === undefined ? {} : { accountId: { gt: query.cursor } }) }, _count: { _all: true }, orderBy: { accountId: "asc" }, take: query.limit });
  const data: DigestEntry[] = [];
  for (const group of groups) {
    const rows = await db.conversationMember.findMany({ where: { accountId: group.accountId, inboxFolder: "requests", leftAt: null, unreadCount: { gt: 0 }, conversation: { kind: "direct", lastMessageAt: { gte: query.since } } }, include: { conversation: { include: { members: true } } }, orderBy: { conversationId: "desc" }, take: sampleSize });
    if (rows.length === 0) continue;
    const senderIds = rows.flatMap((row) => row.conversation.members.filter((member) => member.accountId !== group.accountId).map((member) => member.accountId));
    const people = await context.directory.findUserSummaries(senderIds);
    const requests = senderIds.flatMap((id) => { const person = people.get(id); return person === undefined ? [] : [{ name: person.name, handle: person.username }]; });
    data.push({ userId: group.accountId, props: { requests, totalPending: group._count._all } });
  }
  return { data, nextCursor: groups.length === query.limit ? (groups.at(-1)?.accountId ?? null) : null };
}

async function weeklyDigests(context: HandlerContext, query: ListDigestPageQuery): Promise<DigestPage> {
  const db = context.database.client;
  const weekAgo = new Date(context.clock.now().getTime() - 7 * 86_400_000);
  const groups = await db.follow.groupBy({ by: ["followerId"], where: { state: "accepted", ...(query.cursor === undefined ? {} : { followerId: { gt: query.cursor } }) }, orderBy: { followerId: "asc" }, take: query.limit });
  const data: DigestEntry[] = [];
  for (const group of groups) {
    if (!(await context.directory.hasPersonalizationConsent(group.followerId))) continue;
    const followed = await followRepository.allFollowedAccountIds(db, group.followerId, 100);
    const posts = await db.post.findMany({ where: { authorId: { in: followed }, kind: { in: ["post", "clip"] }, audience: "everyone", visibility: "public", ...publishedPostToViewers, createdAt: { gte: weekAgo } }, orderBy: [{ likeCount: "desc" }, { id: "desc" }], take: sampleSize });
    if (posts.length === 0) continue;
    const authors = await context.directory.findUserSummaries(posts.map((post) => post.authorId));
    const topPosts = posts.flatMap((post) => { const author = authors.get(post.authorId); return author === undefined ? [] : [{ postId: post.id, authorName: author.name, authorHandle: author.username, excerpt: post.text.slice(0, 120), likes: post.likeCount }]; });
    data.push({ userId: group.followerId, props: { weekLabel: `Week of ${weekAgo.toISOString().slice(0, 10)}`, topPosts, trending: [], upcomingLives: [] } });
  }
  return { data, nextCursor: groups.length === query.limit ? (groups.at(-1)?.followerId ?? null) : null };
}
