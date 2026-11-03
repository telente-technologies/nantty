import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError } from "@/errors/api.error";

import { createMockPostFromInput } from "./composer.mock";

describe("mock post author profile", () => {
  it("attributes a post to the signed-in user's selected store profile", () => {
    const post = createMockPostFromInput({ text: "Store update", mediaIds: [], audience: "everyone", asProfileId: "s_home" });

    assert.equal(post.author.id, "u_me");
    assert.equal(post.author.username, "temi.homes");
    assert.deepEqual(post.postedAs, {
      id: "s_home",
      kind: "store",
      name: "Temi's Home & Kitchen",
      handle: "temi.homes",
      avatarUrl: post.author.avatarUrl,
    });
  });

  it("rejects a profile that does not belong to the signed-in mock account", () => {
    assert.throws(
      () => createMockPostFromInput({ text: "Unauthorized store post", mediaIds: [], audience: "everyone", asProfileId: "s_ada" }),
      (error: unknown) => error instanceof ApiError && error.status === 403,
    );
  });
});
