import { resolveMockApiRequest } from "@/mocks";
import type { FollowSuggestion, HeadlinesPage, RankedPost, TrendsPage } from "@/types/explore.type";

describe("explore home mocks", () => {
  it("lets guests read every explore section", async () => {
    for (const path of ["/api/v1/explore/categories", "/api/v1/explore/trends", "/api/v1/explore/headlines", "/api/v1/explore/who-to-follow", "/api/v1/explore/posts-for-you"]) {
      await expect(resolveMockApiRequest("GET", path, undefined, undefined, true)).resolves.toBeDefined();
    }
  });

  it("labels headlines as summarised from posts and links them to posts", async () => {
    const page = await resolveMockApiRequest<HeadlinesPage>("GET", "/api/v1/explore/headlines", undefined);
    expect(page.items.length).toBeGreaterThan(0);
    for (const headline of page.items) {
      expect(headline.sourceLabel).toBe("Summarised from posts");
      expect(headline.postIds.length).toBeGreaterThan(0);
    }
  });

  it("filters trends by category and explains posts for you", async () => {
    const sports = await resolveMockApiRequest<TrendsPage>("GET", "/api/v1/explore/trends?category=sports", undefined);
    expect(sports.items.every((trend) => trend.category === "sports")).toBe(true);
    const posts = await resolveMockApiRequest<{ data: RankedPost[] }>("GET", "/api/v1/explore/posts-for-you?category=for_you", undefined);
    expect(posts.data[0]?.ranking?.explanations.length).toBeGreaterThan(0);
    const suggestions = await resolveMockApiRequest<{ data: FollowSuggestion[] }>("GET", "/api/v1/explore/who-to-follow?limit=3", undefined);
    expect(suggestions.data.some((suggestion) => suggestion.isOfficial)).toBe(true);
  });
});
