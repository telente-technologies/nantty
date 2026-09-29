import type { Clip, Page } from "@/types";

import { clipVideoSeeds, type ClipVideoSeed } from "./clipsVideoCatalog.mock";
import { isoDateHoursAgo } from "./fixtures.mock";
import { productSummaryByKey } from "./productCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { buildFriendsLikedFromFollowedUsers, isFollowingUser } from "./socialGraph.mock";
import { userSummaryById } from "./userDirectory.mock";

const CLIPS_PAGE_SIZE = 6;

const buildClipFromVideoSeed = (seed: ClipVideoSeed): Clip => {
  const author = userSummaryById(seed.authorId);
  return {
    id: seed.id,
    kind: "clip",
    author,
    createdAt: isoDateHoursAgo(seed.hoursAgo),
    text: seed.caption,
    media: [
      {
        type: "video",
        url: seed.videoUrl,
        posterUrl: seed.posterUrl,
        hlsUrl: seed.hlsUrl ?? null,
        width: seed.width,
        height: seed.height,
        durationSeconds: seed.durationSeconds,
        status: "ready",
      },
    ],
    likes: seed.likes,
    comments: seed.comments,
    reposts: Math.round(seed.likes / 40),
    views: seed.views,
    liked: false,
    bookmarked: false,
    isFollowingAuthor: isFollowingUser(seed.authorId),
    friendsLiked: seed.friendIdsWhoLiked
      ? buildFriendsLikedFromFollowedUsers(seed.friendIdsWhoLiked, seed.friendIdsWhoLiked.length + 9)
      : null,
    products: (seed.taggedProductKeys ?? []).map(productSummaryByKey),
    sponsored: seed.sponsoredCampaign ? { ...seed.sponsoredCampaign, label: "Sponsored" } : null,
    durationSeconds: seed.durationSeconds,
    sound: `Original sound · ${author.username}`,
  };
};

const allClips: readonly Clip[] = clipVideoSeeds.map(buildClipFromVideoSeed);

const listClipsForFeedTab = (tab: string | null): readonly Clip[] =>
  tab === "following"
    ? [...allClips].filter((clip) => clip.isFollowingAuthor && !clip.sponsored).reverse()
    : allClips;

const pageOfClips = (clips: readonly Clip[], cursor: string | null): Page<Clip> => {
  const start = Number(cursor ?? 0) || 0;
  const end = start + CLIPS_PAGE_SIZE;
  return { data: clips.slice(start, end), nextCursor: end < clips.length ? String(end) : null };
};

export const clipsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/clips", ({ query }) => pageOfClips(listClipsForFeedTab(query.get("tab")), query.get("cursor"))),
];
