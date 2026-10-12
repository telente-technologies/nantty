import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createSocialDatabase } from "../../src/databases/prisma.database.js";
import { deterministicFeedRanker } from "../../src/integrations/deterministicFeedRanker.integration.js";
import { noPremiumEntitlements } from "../../src/integrations/premiumEntitlements.integration.js";
import type { IdentityDirectory } from "../../src/interfaces/identityDirectory.interface.js";
import { createDeleteCommentHandler } from "../../src/modules/comments/commands/deleteComment/deleteComment.handler.js";
import { createHideCommentHandler } from "../../src/modules/comments/commands/hideComment/hideComment.handler.js";
import { createUnhideCommentHandler } from "../../src/modules/comments/commands/unhideComment/unhideComment.handler.js";
import { createListMyPostCommentsHandler } from "../../src/modules/comments/queries/listMyPostComments/listMyPostComments.handler.js";
import { createListPostCommentsHandler } from "../../src/modules/comments/queries/listPostComments/listPostComments.handler.js";

const enabled = process.env["RUN_INTEGRATION"] === "1" && process.env["DATABASE_URL"] !== undefined;

const directory: IdentityDirectory = {
  findUserSummaries: async (ids) => new Map(ids.map((id) => [id, { id, name: id, username: id.slice(0, 8), avatarUrl: null, verified: false, isCreator: false }])),
  findAccountIdsByUsernames: async () => new Map(), searchUserSummaries: async () => [], findPrivateAccountIds: async () => new Set(), findMentionPrivacy: async () => new Map(),
  findMentionTargetStatuses: async () => new Map(), hasPersonalizationConsent: async () => false, findAccountsAllowingPersonalizedAds: async () => new Set<string>(), findCheckmarkColors: async () => new Map(), findAccountCreatedAt: async () => undefined,
  findOwnedPostableProfile: async () => null, findProfilesByIds: async () => new Map(),
};

describe.skipIf(!enabled)("comment hiding (needs Postgres with the social schema migrated)", () => {
  it("hides under row locks, keeps counts right through races and deletes, and filters the owner's inbox", async () => {
    const database = createSocialDatabase(process.env["DATABASE_URL"] as string);
    let tick = Date.parse("2026-10-11T09:00:00Z");
    const context = { database, directory, clock: { now: () => new Date((tick += 1000)) }, premium: noPremiumEntitlements, ranker: deterministicFeedRanker };
    const [ownerId, fanId] = [randomUUID(), randomUUID()];
    const post = await database.client.post.create({ data: { authorId: ownerId, kind: "post", text: "hide me", commentCount: 4 } });
    const make = (text: string, parent: { id: string; rootCommentId: string | null; path: string; depth: number } | null, authorId = fanId) =>
      database.client.comment.create({ data: { postId: post.id, authorId, text, parentCommentId: parent?.id ?? null, rootCommentId: parent === null ? null : (parent.rootCommentId ?? parent.id), depth: parent === null ? 0 : parent.depth + 1, path: parent === null ? "" : (parent.path === "" ? parent.id : `${parent.path}/${parent.id}`) } });
    const root = await make("Does it ship to Abuja?", null);
    const reply = await make("reply", root);
    await make("child", reply);
    const other = await make("other", null);
    await database.client.comment.update({ where: { id: root.id }, data: { replyCount: 1 } });
    const hide = createHideCommentHandler(context);
    const unhide = createUnhideCommentHandler(context);
    const request = { actorId: ownerId, postId: post.id, commentId: root.id };
    await Promise.all([hide(request), hide(request), unhide(request), hide(request)]);
    const after = await database.client.comment.findUniqueOrThrow({ where: { id: root.id } });
    const expected = after.hiddenAt === null ? 4 : 1;
    expect((await database.client.post.findUniqueOrThrow({ where: { id: post.id } })).commentCount).toBe(expected);
    await hide(request);
    expect((await database.client.post.findUniqueOrThrow({ where: { id: post.id } })).commentCount).toBe(1);
    await expect(hide({ ...request, actorId: fanId })).rejects.toMatchObject({ status: 403 });
    const publicList = await createListPostCommentsHandler(context)({ viewerId: undefined, postId: post.id, filter: undefined, cursor: undefined, limit: 10 });
    expect(publicList.data.map((item) => item.id)).toEqual([other.id]);
    const ownList = await createListPostCommentsHandler(context)({ viewerId: fanId, postId: post.id, filter: undefined, cursor: undefined, limit: 10 });
    expect(ownList.data.map((item) => item.id).sort()).toEqual([root.id, other.id].sort());
    const inbox = createListMyPostCommentsHandler(context);
    const base = { ownerId, postId: undefined, search: undefined, cursor: undefined, limit: 1 };
    expect((await inbox({ ...base, filter: "hidden" })).data.map((item) => item.id)).toEqual([root.id]);
    const firstPage = await inbox({ ...base, filter: "needs_reply" });
    expect(firstPage.data.map((item) => item.id)).toEqual([other.id]);
    expect(firstPage.nextCursor).toBeNull();
    expect((await inbox({ ...base, filter: "all", search: "ABUJA" })).data).toEqual([]);
    await make("thanks", { id: other.id, rootCommentId: null, path: "", depth: 0 }, ownerId);
    expect((await inbox({ ...base, filter: "needs_reply" })).data).toEqual([]);
    await createDeleteCommentHandler(context)({ actorId: ownerId, commentId: root.id });
    expect((await database.client.post.findUniqueOrThrow({ where: { id: post.id } })).commentCount).toBe(1);
    await expect(unhide(request)).rejects.toMatchObject({ status: 404 });
    expect(await database.client.outboxEvent.count({ where: { subject: root.id, eventType: { in: ["comment.hidden", "comment.unhidden"] } } })).toBeGreaterThanOrEqual(1);
    await database.disconnect();
  });
});
