import { describe, expect, it } from "vitest";

import { HandleDomainEventHandler } from "../src/modules/eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import { createTestHarness, makeEvent, silentLogger } from "./fakes/testHarness.fake.js";

const context = { webBaseUrl: "https://zudomart.com", sellerDashboardUrl: "https://dashboard.zudomart.com" };
const actor = { id: "quoter", name: "Ada" };

function setup() {
  const harness = createTestHarness();
  const handler = new HandleDomainEventHandler(harness.dispatcher, { handlePolicyPublished: async () => undefined }, context, silentLogger, undefined, undefined, undefined, harness.notifications);
  return { harness, handler };
}

describe("post.deleted clears related notifications", () => {
  it("removes notifications that point at the deleted post and keeps the rest", async () => {
    const { harness, handler } = setup();
    await handler.execute({ event: makeEvent("post.reshared", { postId: "quote-1", originalPostId: "p1", authorId: "quoter", originalAuthorId: "author", isQuote: true, actor, url: "/post/quote-1" }, "e1") });
    await handler.execute({ event: makeEvent("post.reshared", { postId: "quote-2", originalPostId: "p9", authorId: "quoter", originalAuthorId: "author", isQuote: true, actor, url: "/post/quote-2" }, "e2") });
    expect(harness.notifications.rows).toHaveLength(2);
    const result = await handler.execute({ event: makeEvent("post.deleted", { postId: "p1", authorId: "author", kind: "post" }, "e3") });
    expect(result).toMatchObject({ handled: true, intents: 0 });
    expect(harness.notifications.rows.map((row) => row.data["postId"])).toEqual(["quote-2"]);
  });

  it("is a safe no-op when replayed or when nothing matches", async () => {
    const { harness, handler } = setup();
    await handler.execute({ event: makeEvent("post.deleted", { postId: "missing" }, "e4") });
    await handler.execute({ event: makeEvent("post.deleted", { postId: "missing" }, "e4") });
    expect(harness.notifications.rows).toHaveLength(0);
  });
});
