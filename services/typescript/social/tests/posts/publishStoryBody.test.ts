import { describe, expect, it } from "vitest";

import { publishStoryBodySchema } from "../../src/modules/posts/validators/posts.validator.js";

const mediaId = "0192f0a0-0000-7000-8000-0000000000aa";

describe("publish story body", () => {
  it("accepts the client contract of mediaId with optional sound and look", () => {
    const result = publishStoryBodySchema.safeParse({ mediaId, soundId: "0192f0a0-0000-7000-8000-0000000000bb", look: "warm" });
    expect(result.success).toBe(true);
  });

  it("strips fields outside the contract instead of trusting them", () => {
    const result = publishStoryBodySchema.safeParse({ mediaId, media: { id: mediaId, type: "image", url: "https://attacker.example/x.jpg" } });
    expect(result.success).toBe(true);
    expect(result.success ? result.data : null).toEqual({ mediaId });
  });

  it("requires a media id", () => {
    expect(publishStoryBodySchema.safeParse({ look: "warm" }).success).toBe(false);
    expect(publishStoryBodySchema.safeParse({ mediaId: "not-a-uuid" }).success).toBe(false);
  });
});
