import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createSocialDatabase } from "../../src/databases/prisma.database.js";
import { deterministicFeedRanker } from "../../src/integrations/deterministicFeedRanker.integration.js";
import { noPremiumEntitlements } from "../../src/integrations/premiumEntitlements.integration.js";
import type { Clock } from "../../src/interfaces/clock.interface.js";
import type { IdentityDirectory } from "../../src/interfaces/identityDirectory.interface.js";
import { createDeleteCommentHandler } from "../../src/modules/comments/commands/deleteComment/deleteComment.handler.js";
import { createPinCommentHandler } from "../../src/modules/comments/commands/pinComment/pinComment.handler.js";
import { createListPostCommentsHandler } from "../../src/modules/comments/queries/listPostComments/listPostComments.handler.js";
import { createPinPostHandler } from "../../src/modules/posts/commands/pinPost/pinPost.handler.js";
import { createUnpinPostHandler } from "../../src/modules/posts/commands/unpinPost/unpinPost.handler.js";
import { createGetPostHandler } from "../../src/modules/posts/queries/getPost/getPost.handler.js";
import { createListUserPostsHandler } from "../../src/modules/posts/queries/listUserPosts/listUserPosts.handler.js";

const enabled = process.env["RUN_INTEGRATION"] === "1" && process.env["DATABASE_URL"] !== undefined;

const directory: IdentityDirectory = {
  findUserSummaries: async (ids) => new Map(ids.map((id) => [id, { id, name: id, username: id.slice(0, 8), avatarUrl: null, verified: false, isCreator: false }])),
  findAccountIdsByUsernames: async () => new Map(), searchUserSummaries: async () => [], findPrivateAccountIds: async () => new Set(), findMentionPrivacy: async () => new Map(),
  findMentionTargetStatuses: async () => new Map(), hasPersonalizationConsent: async () => false, findAccountsAllowingPersonalizedAds: async () => new Set<string>(), findCheckmarkColors: async () => new Map(), findProfileCheckmarkColors: async () => new Map(), findAccountCreatedAt: async () => undefined,
  findOwnedPostableProfile: async () => null, findProfilesByIds: async () => new Map(),
};

function steppingClock(): Clock {
  let tick = Date.parse("2026-10-10T09:00:00Z");
  return { now: () => new Date((tick += 1000)) };
}

describe.skipIf(!enabled)("pins (needs Postgres with the social schema migrated)", () => {
  it("lists pinned posts first, most recently pinned first, across cursor pages", async () => {
    const database = createSocialDatabase(process.env["DATABASE_URL"] as string);
    const context = { database, directory, clock: steppingClock(), premium: noPremiumEntitlements, ranker: deterministicFeedRanker };
    const ownerId = randomUUID();
    const ids: string[] = [];
    for (let index = 0; index < 6; index += 1) ids.push((await database.client.post.create({ data: { authorId: ownerId, kind: "post", text: `post ${index}` } })).id);
    for (const id of [ids[1], ids[4], ids[2]] as string[]) await createPinPostHandler(context)({ actorId: ownerId, postId: id });
    await expect(createPinPostHandler(context)({ actorId: ownerId, postId: ids[0] as string })).rejects.toMatchObject({ status: 409 });
    await expect(createPinPostHandler(context)({ actorId: randomUUID(), postId: ids[0] as string })).rejects.toMatchObject({ status: 403 });
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await createListUserPostsHandler(context)({ viewerId: undefined, ownerId, cursor, limit: 2, kind: undefined });
      seen.push(...page.data.map((post) => post.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);
    expect(seen).toEqual([ids[2], ids[4], ids[1], ids[5], ids[3], ids[0]]);
    await createUnpinPostHandler(context)({ actorId: ownerId, postId: ids[4] as string });
    expect((await createPinPostHandler(context)({ actorId: ownerId, postId: ids[0] as string })).isPinned).toBe(true);
    expect(await database.client.outboxEvent.count({ where: { subject: { in: ids }, eventType: { in: ["post.pinned", "post.unpinned"] } } })).toBe(5);
    await database.disconnect();
  });

  it("pins one top-level comment per post, lists it first and drops it when deleted", async () => {
    const database = createSocialDatabase(process.env["DATABASE_URL"] as string);
    const context = { database, directory, clock: steppingClock(), premium: noPremiumEntitlements, ranker: deterministicFeedRanker };
    const [authorId, commenterId] = [randomUUID(), randomUUID()];
    const post = await database.client.post.create({ data: { authorId, kind: "post", text: "pin me" } });
    const comment = (text: string, parentCommentId: string | null = null) =>
      database.client.comment.create({ data: { postId: post.id, authorId: commenterId, text, parentCommentId, rootCommentId: parentCommentId, depth: parentCommentId === null ? 0 : 1 } });
    const [first, second, third] = [await comment("first"), await comment("second"), await comment("third")];
    const reply = await comment("reply", first.id);
    await createPinCommentHandler(context)({ actorId: authorId, postId: post.id, commentId: first.id });
    await createPinCommentHandler(context)({ actorId: authorId, postId: post.id, commentId: second.id });
    await expect(createPinCommentHandler(context)({ actorId: commenterId, postId: post.id, commentId: third.id })).rejects.toMatchObject({ status: 403 });
    await expect(createPinCommentHandler(context)({ actorId: authorId, postId: post.id, commentId: reply.id })).rejects.toMatchObject({ status: 422 });
    const listed = await createListPostCommentsHandler(context)({ viewerId: undefined, postId: post.id, cursor: undefined, limit: 10 });
    expect(listed.data.map((row) => [row.id, row.type === "comment" ? row.isPinned : null])).toEqual([[second.id, true], [third.id, false], [first.id, false]]);
    expect((await createGetPostHandler(context)({ viewerId: undefined, postId: post.id })).pinnedCommentId).toBe(second.id);
    await createDeleteCommentHandler(context)({ actorId: authorId, commentId: second.id });
    expect((await database.client.post.findUniqueOrThrow({ where: { id: post.id } })).pinnedCommentId).toBeNull();
    await database.disconnect();
  });
});
