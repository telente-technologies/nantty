import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { commentsForPost } from "@/mocks/comments.mock";
import type { ActingProfile } from "@/types/brand.type";
import type { Comment } from "@/types";

const call = <T>(method: string, path: string, body?: unknown) => dispatchMockApiRequest(method, path, new URLSearchParams(), body === undefined ? null : new TextEncoder().encode(JSON.stringify(body))) as Promise<T>;

describe("commenting as a managed profile", () => {
  it("persists the selected owned profile as the visible identity", async () => {
    const profiles = await call<readonly ActingProfile[]>("GET", "/api/v1/users/me/profiles");
    const profile = profiles.find((item) => item.kind === "brand" || item.kind === "store" || item.kind === "business");
    assert.ok(profile);
    const created = await call<Comment>("POST", "/api/v1/posts/post_1/comments", { text: "A note from the brand", asProfileId: profile!.id });
    assert.equal(created.author.id, "u_me");
    assert.deepEqual(created.postedAs, { id: profile.id, kind: profile.kind, name: profile.name, handle: profile.handle, avatarUrl: profile.avatarUrl });
    assert.ok(commentsForPost("post_1").some((comment) => comment.id === created.id && comment.postedAs?.id === profile.id));
  });

  it("does not let a caller comment as a profile they do not own", async () => {
    await assert.rejects(call("POST", "/api/v1/posts/post_1/comments", { text: "Forged identity", asProfileId: "not-owned-profile" }), { status: 404, code: "PROFILE_NOT_FOUND" });
  });
});
