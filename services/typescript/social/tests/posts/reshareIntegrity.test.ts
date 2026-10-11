import { describe, expect, it } from "vitest";

import { createResharePostHandler } from "../../src/modules/posts/commands/resharePost/resharePost.handler.js";
import { createMemoryStore, type Row } from "../comments/memoryDb.fake.js";
import { authorId, buildPostRow, viewerId } from "./socialPostFakes.fake.js";

const originalId = "0192f0a0-0000-7000-8000-0000000000a1";
const followerRepostId = "0192f0a0-0000-7000-8000-0000000000a2";
const followerId = "0192f0a0-0000-7000-8000-00000000c001";

function setup() {
  const store = createMemoryStore({
    posts: [
      { ...buildPostRow({ id: originalId, authorId, text: "Original", audience: "followers" }) } as Row,
      { ...buildPostRow({ id: followerRepostId, authorId: followerId, text: "", resharedFromId: originalId, isQuote: false }) } as Row,
    ],
    postDefaults: () => ({ ...buildPostRow({}), id: undefined }),
  });
  return { store, reshare: createResharePostHandler(store.context), original: () => store.posts.find((row) => row["id"] === originalId) as Row };
}

describe("reshare integrity", () => {
  it("SOC-02: a plain repost is idempotent and does not inflate counters or re-notify", async () => {
    const { store, reshare, original } = setup();
    original()["audience"] = "everyone";
    const first = await reshare({ actorId: viewerId, postId: originalId, text: "" });
    const second = await reshare({ actorId: viewerId, postId: originalId, text: "" });
    const third = await reshare({ actorId: viewerId, postId: followerRepostId, text: "" });
    expect(second.id).toBe(first.id);
    expect(third.id).toBe(first.id);
    expect(original()["repostCount"]).toBe(1);
    expect(store.events.filter((event) => event["eventType"] === "post.reshared")).toHaveLength(1);
  });

  it("SOC-02: quotes are still allowed more than once", async () => {
    const { reshare, original } = setup();
    original()["audience"] = "everyone";
    await reshare({ actorId: viewerId, postId: originalId, text: "one" });
    await reshare({ actorId: viewerId, postId: originalId, text: "two" });
    expect(original()["quoteCount"]).toBe(2);
  });

  it("SOC-03: resharing someone's repost re-checks the original's visibility", async () => {
    const { reshare, original } = setup();
    await expect(reshare({ actorId: viewerId, postId: followerRepostId, text: "" })).rejects.toMatchObject({ status: 403 });
    await expect(reshare({ actorId: viewerId, postId: followerRepostId, text: "look" })).rejects.toMatchObject({ status: 403 });
    expect(original()["repostCount"]).toBe(0);
  });
});
