import { ApiError } from "@/errors/api.error";
import type { NewPostInput, Post, ProductSummary, TagCandidate } from "@/types";

import { getSignedInMockUser } from "./fixtures.mock";
import { convertMediaAssetToPostMedia, currentMediaAsset } from "./media.mock";
import { mockPostsState } from "./postCatalog.mock";
import { buildCatalogProductSummary, findCatalogSeedByProductId } from "./productCatalog.mock";
import { resolveMockQuote } from "./quoteLinks.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { findMutableSoundState } from "./soundCatalog.mock";
import { directoryUsersExcludingAccounts, summariseUser } from "./userDirectory.mock";

const MAXIMUM_TEXT_LENGTH = 2200;
const MAXIMUM_MEDIA_PER_POST = 10;
const replayedPostsByIdempotencyKey = new Map<string, Post>();
let nextPostNumber = 1;

const resolveTaggedProducts = (productIds: readonly string[]): ProductSummary[] => {
  const unique = [...new Set(productIds)];
  const rejected = unique.filter((productId) => !findCatalogSeedByProductId(productId));
  if (rejected.length > 0) throw new ApiError(422, "Only published products can be tagged.", "PRODUCT_NOT_TAGGABLE");
  return unique.map((productId) => buildCatalogProductSummary(findCatalogSeedByProductId(productId)!));
};

export function createMockPostFromInput(input: NewPostInput): Post {
  const text = input.text ?? "";
  const mediaIds = input.mediaIds ?? [];
  if (text.length > MAXIMUM_TEXT_LENGTH) throw new ApiError(422, `Text can be up to ${MAXIMUM_TEXT_LENGTH} characters.`, "TEXT_TOO_LONG");
  if (mediaIds.length > MAXIMUM_MEDIA_PER_POST) throw new ApiError(422, `A post can have up to ${MAXIMUM_MEDIA_PER_POST} media items.`, "TOO_MANY_MEDIA");
  const media = (mediaIds.length > 0 ? mediaIds : (input.media ?? []).map((item) => item.mediaId)).map((mediaId) => {
    const asset = currentMediaAsset(mediaId);
    if (!asset) throw new ApiError(422, "One of the uploads could not be found", "MEDIA_NOT_FOUND");
    if (asset.status === "failed") throw new ApiError(422, "One of the uploads failed. Remove it and try again.", "MEDIA_FAILED");
    if (asset.type === "audio") throw new ApiError(422, "Audio can't be posted on its own", "UNSUPPORTED_POST_MEDIA");
    return convertMediaAssetToPostMedia({ ...asset, type: asset.type });
  });
  const kind = input.kind ?? "post";
  if (kind === "post" && media.length === 0 && text.trim() === "") throw new ApiError(422, "Write something or add media.", "POST_EMPTY");
  if (kind === "clip" && input.slideshow) {
    const durations = input.slideshow.durationsMs;
    if (media.length < 1 || media.some((item) => item.type !== "image")) throw new ApiError(422, "A photo clip uses photos only.", "SLIDESHOW_REQUIRES_PHOTOS");
    if (durations.length !== media.length || durations.some((duration) => duration < 1000 || duration > 10_000)) throw new ApiError(422, "Each photo shows for 1 to 10 seconds.", "INVALID_SLIDESHOW");
    if (durations.reduce((sum, duration) => sum + duration, 0) > 180_000) throw new ApiError(422, "Clips can be up to 3 minutes long.", "CLIP_TOO_LONG");
    media.splice(0, media.length, { ...media[0]!, type: "video", status: "processing", posterUrl: media[0]!.url, durationSeconds: durations.reduce((sum, duration) => sum + duration, 0) / 1000 });
  } else if (kind === "clip" && (media.length !== 1 || media[0]?.type !== "video")) throw new ApiError(422, "A clip needs exactly one video.", "CLIP_REQUIRES_ONE_VIDEO");
  const trim = input.media?.[0]?.trim;
  if (kind === "clip" && trim && (trim.endMs <= trim.startMs || trim.endMs - trim.startMs > 180_000)) throw new ApiError(422, "Trim the clip to 3 minutes or less.", "INVALID_TRIM");
  if (input.soundId) {
    if (kind !== "clip") throw new ApiError(422, "Only clips and stories can use a sound.", "SOUND_REQUIRES_CLIP");
    const sound = findMutableSoundState(input.soundId);
    if (!sound) throw new ApiError(404, "Sound not found.", "SOUND_NOT_FOUND");
    if (!sound.allowReuse || sound.status !== "available") throw new ApiError(403, "This sound can't be used.", "SOUND_NOT_REUSABLE");
  }
  if (kind !== "post" && typeof input.quotedPostId === "string") throw new ApiError(422, "Only posts can quote another post.", "QUOTE_REQUIRES_POST");
  const quote = kind === "post" ? resolveMockQuote(text, input.quotedPostId) : null;
  const quoted = quote ? mockPostsState.get(quote.original.id) : undefined;
  const products = resolveTaggedProducts(input.productIds ?? []);
  const taggedUsers = (input.taggedUserIds ?? []).flatMap((userId) => {
    const user = directoryUsersExcludingAccounts.find((candidate) => candidate.id === userId);
    return user ? [{ id: user.id, username: user.username, displayName: user.name, avatarUrl: user.avatarUrl, checkmark: null }] : [];
  });
  const sensitiveLabels = input.sensitiveLabels ?? [];
  const post: Post = {
    id: `p_new_${Date.now().toString(36)}_${nextPostNumber++}`,
    kind,
    author: getSignedInMockUser(),
    createdAt: new Date().toISOString(),
    text: quote?.text ?? text,
    media,
    likes: 0,
    comments: 0,
    reposts: 0,
    views: 0,
    liked: false,
    bookmarked: false,
    saveCount: 0,
    isFollowingAuthor: true,
    friendsLiked: null,
    products,
    sponsored: null,
    mentions: input.mentions ?? [],
    subscriberOnly: input.visibility === "subscribers",
    viewerHasAccess: true,
    replyPolicy: input.replyPolicy ?? "everyone",
    viewerCanReply: (input.replyPolicy ?? "everyone") !== "off",
    replyRestriction: null,
    sensitive: sensitiveLabels.length > 0 ? { labels: sensitiveLabels, requiresInterstitial: false } : null,
    taggedUsers,
    taggedUsersCount: taggedUsers.length,
    isQuote: quote !== null,
    quotes: 0,
    resharedFrom: quote?.original ?? null,
  };
  mockPostsState.set(post.id, post);
  if (quoted) mockPostsState.set(quoted.id, { ...quoted, reposts: quoted.reposts + 1, quotes: (quoted.quotes ?? 0) + 1 });
  return post;
}

export const composerMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/posts", ({ body }) => {
    const input = body as NewPostInput;
    if (!input || typeof input !== "object") throw new ApiError(422, "Write something or add media.", "POST_EMPTY");
    const replayKey = JSON.stringify(input);
    const replayed = replayedPostsByIdempotencyKey.get(replayKey);
    if (replayed && Date.now() - new Date(replayed.createdAt).getTime() < 10_000) return replayed;
    const post = createMockPostFromInput(input);
    replayedPostsByIdempotencyKey.set(replayKey, post);
    return post;
  }),
  createMockRoute("GET", "/api/v1/tags/candidates", ({ query }) => {
    const term = (query.get("q") ?? "").trim().toLowerCase();
    const candidates: TagCandidate[] = directoryUsersExcludingAccounts
      .filter((user) => term !== "" && (user.name.toLowerCase().includes(term) || user.username.toLowerCase().includes(term)))
      .slice(0, 10)
      .map((user, index) => ({ user: summariseUser(user), canTag: index !== 3, unavailableReason: index === 3 ? "Doesn't allow tags" : null }));
    return { candidates };
  }),
];
