import { mockPostsState } from "./postCatalog.mock";
import { mediaMocks } from "./media.mock";

describe("mock posts published for an acting profile", () => {
  it("keeps the authenticated account as author and records the store separately", () => {
    const route = mediaMocks.find((candidate) => candidate.method === "POST" && candidate.path === "/api/v1/posts");
    if (!route) throw new Error("post creation mock route is missing");

    const post = route.handler({
      params: {},
      query: new URLSearchParams(),
      body: { text: "Store update", mediaIds: [], audience: "everyone", asProfileId: "s_home" },
    }) as { id: string; author: { id: string }; postedAs?: { id: string } | null };

    expect(post.author.id).toBe("u_me");
    expect(post.postedAs?.id).toBe("s_home");
    mockPostsState.delete(post.id);
  });
});
