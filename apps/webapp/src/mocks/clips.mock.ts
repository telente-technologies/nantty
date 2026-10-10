import type { Clip, Page } from "@/types";

import { clipVideoSeeds, type ClipVideoSeed } from "./clipsVideoCatalog.mock";
import { isoDateHoursAgo } from "./fixtures.mock";
import { productSummaryByKey } from "./productCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { isTargetSavedByViewer } from "./saveState.mock";
import { hasSignedInViewerSubscribedToCreator } from "./creatorSubscriptions.mock";
import { currentSoundForClip } from "./soundCatalog.mock";
import { buildFriendsLikedFromFollowedUsers, isFollowingUser } from "./socialGraph.mock";
import { userSummaryById } from "./userDirectory.mock";
import { taggedUsersFieldsForPost } from "./taggedUsers.mock";

const CLIPS_PAGE_SIZE = 6;
const CLIP_IDS_BY_CREATORS = new Set(["clip_amaka_haul", "clip_aisha_fitcheck", "clip_kelechi_bts", "clip_olumide_barber", "clip_bisola_jollof", "clip_dami_break"]);
const SUBSCRIBER_ONLY_CLIP_ACCESS: Readonly<Record<string, boolean>> = { clip_kelechi_bts: false, clip_bisola_jollof: true };

const buildClipFromVideoSeed = (seed: ClipVideoSeed): Clip => {
  const author = { ...userSummaryById(seed.authorId), isCreator: CLIP_IDS_BY_CREATORS.has(seed.id) };
  const subscriberOnlyAccess = SUBSCRIBER_ONLY_CLIP_ACCESS[seed.id];
  return {
    id: seed.id,
    kind: "clip",
    author,
    createdAt: isoDateHoursAgo(seed.hoursAgo),
    text: seed.caption,
    media: [
      {
        id: `m_${seed.id}`,
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
    shares: Math.round(seed.likes / 9),
    views: seed.views,
    liked: false,
    bookmarked: false,
    saveCount: 0,
    isFollowingAuthor: isFollowingUser(seed.authorId),
    friendsLiked: seed.friendIdsWhoLiked
      ? buildFriendsLikedFromFollowedUsers(seed.friendIdsWhoLiked, seed.friendIdsWhoLiked.length + 9)
      : null,
    products: (seed.taggedProductKeys ?? []).map(productSummaryByKey),
    sponsored: seed.sponsoredCampaign ? { ...seed.sponsoredCampaign, label: "Sponsored" } : null,
    subscriberOnly: subscriberOnlyAccess !== undefined,
    viewerHasAccess: subscriberOnlyAccess ?? true,
    durationSeconds: seed.durationSeconds,
    sound: currentSoundForClip(seed.id),
    ...taggedUsersFieldsForPost(seed.id),
  };
};

const PROMOTED_LIVE_CLIP_ID = "clip_olumide_barber";

const turnIntoPromotedLiveStream = (clip: Clip): Clip =>
  clip.id !== PROMOTED_LIVE_CLIP_ID
    ? clip
    : {
        ...clip,
        text: "LIVE now: Friday fade specials, walk-ins welcome in Yaba 💈 Join and ask me anything",
        sponsored: { campaignId: "cmp_live_olumide_cuts", label: "Sponsored", advertiserName: clip.author.name },
        promotedLive: { liveSessionId: "live_olumide_cuts", title: "Friday fade specials", viewers: 1284 },
      };

const allClips: readonly Clip[] = clipVideoSeeds.map(buildClipFromVideoSeed).map(turnIntoPromotedLiveStream);

const withCurrentSound = (clip: Clip): Clip => ({
  ...clip,
  bookmarked: isTargetSavedByViewer("clip", clip.id),
  sound: currentSoundForClip(clip.id),
  viewerHasAccess: clip.viewerHasAccess || hasSignedInViewerSubscribedToCreator(clip.author.id),
});

export const findMockClipsByIds = (clipIds: readonly string[]): Clip[] =>
  clipIds.map((clipId) => allClips.find((clip) => clip.id === clipId)).filter((clip): clip is Clip => !!clip).map(withCurrentSound);

export const listMockClipsByAuthorId = (authorId: string): Clip[] =>
  allClips.filter((clip) => clip.author.id === authorId).map(withCurrentSound);

const listClipsForFeedTab = (tab: string | null): readonly Clip[] =>
  tab === "following"
    ? [...allClips].filter((clip) => clip.isFollowingAuthor && !clip.sponsored).reverse()
    : allClips;

const pageOfClips = (clips: readonly Clip[], cursor: string | null): Page<Clip> => {
  const start = Number(cursor ?? 0) || 0;
  const end = start + CLIPS_PAGE_SIZE;
  return { data: clips.slice(start, end).map(withCurrentSound), nextCursor: end < clips.length ? String(end) : null };
};

export const clipsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/clips", ({ query }) => pageOfClips(listClipsForFeedTab(query.get("tab")), query.get("cursor"))),
  createMockRoute("GET", "/api/v1/users/:userId/clips", ({ params, query }) =>
    pageOfClips(listMockClipsByAuthorId(params.userId!), query.get("cursor")),
  ),
];
