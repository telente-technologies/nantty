import type { Page, Post } from "@/types";

import { clipVideoSeeds } from "./clipsVideoCatalog.mock";
import { isAuthorContentVisibleToSignedInViewer } from "./socialGraph.mock";
import { mockPostsState, sponsoredFeedPosts, withCurrentProductPrices } from "./postCatalog.mock";
import { isWithheldFromViewerWithoutAge } from "./postAudience.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { withViewerSavedState } from "./savedEntries.mock";
import { SUSPENDED_USER_IDS } from "./userDirectory.mock";

const TOPICS = ["For You", "Fashion", "Gadgets", "Food", "Beauty", "Home & Living", "Football", "Travel"];
const POSTS_PER_PAGE = 7;
const SUGGESTED_CLIPS_COUNT = 6;

const listSuggestedClipsWithPosterThumbnails = () =>
  clipVideoSeeds
    .filter((seed) => !seed.sponsoredCampaign)
    .slice(0, SUGGESTED_CLIPS_COUNT)
    .map((seed) => ({ id: seed.id, thumbnailUrl: seed.posterUrl }));

const byNewestFirst = (a: Post, b: Post) => b.createdAt.localeCompare(a.createdAt);
const popularityScore = (post: Post) => post.likes + post.comments * 2 + post.reposts * 3 + post.views / 100;
const byMostPopularFirst = (a: Post, b: Post) => popularityScore(b) - popularityScore(a);

const pageOfPostsWithSponsoredSlot = (
  cursor: string | null,
  filter: (post: Post) => boolean = () => true,
  order: (a: Post, b: Post) => number = byNewestFirst,
): Page<Post> => {
  const organic = [...mockPostsState.values()].filter((post) => isAuthorContentVisibleToSignedInViewer(post.author.id) && !SUSPENDED_USER_IDS.has(post.author.id)).filter(filter).sort(order);
  const start = Number(cursor ?? 0);
  const pageIndex = Math.floor(start / POSTS_PER_PAGE);
  const pageOfOrganic = organic.slice(start, start + POSTS_PER_PAGE).map(withCurrentProductPrices);
  const sponsored = sponsoredFeedPosts[pageIndex % sponsoredFeedPosts.length];
  const sponsoredSlot = 3 + (pageIndex % 3);
  const data = sponsored && pageOfOrganic.length >= sponsoredSlot
    ? [...pageOfOrganic.slice(0, sponsoredSlot), withCurrentProductPrices(sponsored), ...pageOfOrganic.slice(sponsoredSlot)]
    : pageOfOrganic;
  return { data: data.map((post) => withViewerSavedState(post)), nextCursor: start + POSTS_PER_PAGE < organic.length ? String(start + POSTS_PER_PAGE) : null };
};

export const feedMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/feeds/for-you", ({ query, isGuest }) =>
    pageOfPostsWithSponsoredSlot(query.get("cursor"), isGuest ? (post) => !isWithheldFromViewerWithoutAge(post) : undefined, isGuest ? byMostPopularFirst : byNewestFirst),
  ),
  createMockRoute("GET", "/api/v1/feeds/following", ({ query }) => pageOfPostsWithSponsoredSlot(query.get("cursor"), (p) => p.isFollowingAuthor)),
  createMockRoute("GET", "/api/v1/feeds/suggested-clips", listSuggestedClipsWithPosterThumbnails),
  createMockRoute("GET", "/api/v1/users/me/topics", () => TOPICS.slice(1).map((name, i) => ({ id: `t_${i + 1}`, name }))),
];
