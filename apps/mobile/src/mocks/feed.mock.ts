import type { Page, Post } from "@/types";

import { clipVideoSeeds } from "./clipsVideoCatalog.mock";
import { mockPostsState, sponsoredFeedPosts, withCurrentProductPrices } from "./postCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const TOPICS = ["For You", "Fashion", "Gadgets", "Food", "Beauty", "Home & Living", "Football", "Travel"];
const POSTS_PER_PAGE = 7;
const SUGGESTED_CLIPS_COUNT = 6;

const listSuggestedClipsWithPosterThumbnails = () =>
  clipVideoSeeds
    .filter((seed) => !seed.sponsoredCampaign)
    .slice(0, SUGGESTED_CLIPS_COUNT)
    .map((seed) => ({ id: seed.id, thumbnailUrl: seed.posterUrl }));

const byNewestFirst = (a: Post, b: Post) => b.createdAt.localeCompare(a.createdAt);

const pageOfPostsWithSponsoredSlot = (cursor: string | null, filter: (post: Post) => boolean = () => true): Page<Post> => {
  const organic = [...mockPostsState.values()].filter(filter).sort(byNewestFirst);
  const start = Number(cursor ?? 0);
  const pageIndex = Math.floor(start / POSTS_PER_PAGE);
  const pageOfOrganic = organic.slice(start, start + POSTS_PER_PAGE).map(withCurrentProductPrices);
  const sponsored = sponsoredFeedPosts[pageIndex % sponsoredFeedPosts.length];
  const sponsoredSlot = 3 + (pageIndex % 3);
  const data = sponsored && pageOfOrganic.length >= sponsoredSlot
    ? [...pageOfOrganic.slice(0, sponsoredSlot), withCurrentProductPrices(sponsored), ...pageOfOrganic.slice(sponsoredSlot)]
    : pageOfOrganic;
  return { data, nextCursor: start + POSTS_PER_PAGE < organic.length ? String(start + POSTS_PER_PAGE) : null };
};

export const feedMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/feeds/for-you", ({ query }) => pageOfPostsWithSponsoredSlot(query.get("cursor"))),
  createMockRoute("GET", "/api/v1/feeds/following", ({ query }) => pageOfPostsWithSponsoredSlot(query.get("cursor"), (p) => p.isFollowingAuthor)),
  createMockRoute("GET", "/api/v1/feeds/suggested-clips", listSuggestedClipsWithPosterThumbnails),
  createMockRoute("GET", "/api/v1/users/me/topics", () => TOPICS.slice(1).map((name, i) => ({ id: `t_${i + 1}`, name }))),
];
