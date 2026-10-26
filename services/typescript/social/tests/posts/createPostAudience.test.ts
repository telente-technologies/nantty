import { describe, expect, it } from "vitest";

import { canViewerSeePostByAudience } from "../../src/modules/posts/services/postRules.service.js";
import { createPostBodySchema } from "../../src/modules/posts/validators/posts.validator.js";

const authorId = "0192f0a0-0000-7000-8000-0000000000a1";
const followerId = "0192f0a0-0000-7000-8000-0000000000a2";
const strangerId = "0192f0a0-0000-7000-8000-0000000000a3";

describe("create-post audience contract", () => {
  it.each(["everyone", "followers"] as const)("accepts the supported %s audience", (audience) => {
    expect(createPostBodySchema.safeParse({ text: "Audience contract", audience }).success).toBe(true);
  });

  it("does not accept subscribers as an audience value", () => {
    expect(createPostBodySchema.safeParse({ text: "Unsupported audience", audience: "subscribers" }).success).toBe(false);
  });

  it("allows Everyone posts broadly and Followers posts only to accepted followers", () => {
    expect(canViewerSeePostByAudience({ audience: "everyone", viewerId: strangerId, authorId, viewerFollowsAuthor: false })).toBe(true);
    expect(canViewerSeePostByAudience({ audience: "followers", viewerId: followerId, authorId, viewerFollowsAuthor: true })).toBe(true);
    expect(canViewerSeePostByAudience({ audience: "followers", viewerId: strangerId, authorId, viewerFollowsAuthor: false })).toBe(false);
    expect(canViewerSeePostByAudience({ audience: "followers", viewerId: undefined, authorId, viewerFollowsAuthor: false })).toBe(false);
  });
});
