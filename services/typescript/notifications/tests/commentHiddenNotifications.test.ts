import { describe, expect, it } from "vitest";

import { HandleDomainEventHandler } from "../src/modules/eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import { createTestHarness, makeEvent, silentLogger } from "./fakes/testHarness.fake.js";

const context = { webBaseUrl: "https://nantty.com", sellerDashboardUrl: "https://dashboard.nantty.com" };
const actor = { id: "commenter", name: "Ada" };
const comment = (commentId: string, recipientUserId: string, id: string) =>
  makeEvent("comment.created", { recipientUserId, actor, target: "post", excerpt: "hi", url: `/post/p1?comment=${commentId}`, commentId, postId: "p1", authorId: "commenter" }, id);
const visibility = (type: "comment.hidden" | "comment.unhidden", commentId: string, id: string) =>
  makeEvent(type, { commentId, postId: "p1", commentAuthorId: "commenter", parentCommentId: null, actorId: "author" }, id);

function setup() {
  const harness = createTestHarness();
  const handler = new HandleDomainEventHandler(harness.dispatcher, { handlePolicyPublished: async () => undefined }, context, silentLogger, undefined, undefined, undefined, harness.notifications);
  return { harness, handler };
}

describe("comment hiding withdraws and restores in-app notifications", () => {
  it("hides the comment and mention notifications of that comment only, then restores them", async () => {
    const { harness, handler } = setup();
    await handler.execute({ event: comment("c1", "author", "e1") });
    await handler.execute({ event: makeEvent("mention.created", { recipientUserId: "friend", mentionedUserId: "friend", actor, authorId: "commenter", surface: "comment", postId: "p1", commentId: "c1", excerpt: "hi", url: "/post/p1?comment=c1" }, "e2") });
    await handler.execute({ event: comment("c2", "author", "e3") });
    expect(await harness.notifications.countUnread("author")).toBe(2);

    const hidden = await handler.execute({ event: visibility("comment.hidden", "c1", "e4") });
    expect(hidden).toMatchObject({ handled: true, intents: 0, reason: "comment_hidden" });
    expect((await harness.notifications.list("author", "all", 10, null)).rows.map((row) => row.data["commentId"])).toEqual(["c2"]);
    expect(await harness.notifications.countUnread("author")).toBe(1);
    expect((await harness.notifications.list("friend", "all", 10, null)).rows).toHaveLength(0);
    expect(harness.notifications.rows).toHaveLength(3);

    await handler.execute({ event: visibility("comment.unhidden", "c1", "e5") });
    expect(await harness.notifications.countUnread("author")).toBe(2);
    expect((await harness.notifications.list("friend", "all", 10, null)).rows).toHaveLength(1);
  });

  it("matches notifications stored before commentId was recorded, by their link", async () => {
    const { harness } = setup();
    await harness.notifications.insertIfAbsent({ userId: "author", dedupeKey: "legacy", category: "social", kind: null, templateKey: null, title: "Ada", body: "commented on your post.", actor, data: { url: "/post/p1?comment=c9" } });
    expect(await harness.notifications.setHiddenForComment("c9", true)).toBe(1);
    expect(await harness.notifications.countUnread("author")).toBe(0);
    expect(await harness.notifications.setHiddenForComment("c9", true)).toBe(0);
  });

  it("ignores a visibility event without a comment id or with nothing to match", async () => {
    const { harness, handler } = setup();
    expect(await handler.execute({ event: makeEvent("comment.hidden", { postId: "p1" }, "e6") })).toMatchObject({ handled: false });
    expect(await handler.execute({ event: visibility("comment.unhidden", "missing", "e7") })).toMatchObject({ handled: true });
    expect(harness.notifications.rows).toHaveLength(0);
  });
});
