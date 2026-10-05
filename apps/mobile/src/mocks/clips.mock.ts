import type { Clip, Page } from "@/types";

import { clipVideoSeeds, type ClipVideoSeed } from "./clipsVideoCatalog.mock";
import { isoDateHoursAgo } from "./fixtures.mock";
import { productSummaryByKey } from "./productCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { withViewerSavedState } from "./savedEntries.mock";
import { hasSignedInViewerSubscribedToCreator } from "./creatorSubscriptions.mock";
import { currentSoundForClip } from "./soundCatalog.mock";
import { buildFriendsLikedFromFollowedUsers, isAuthorContentVisibleToSignedInViewer, isFollowingUser } from "./socialGraph.mock";
import { SUSPENDED_USER_IDS, userSummaryById } from "./userDirectory.mock";
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

const DEMO_OWN_CLIPS = [
  { id: "clip_me_demo_1", sourceId: "clip_aisha_fitcheck", caption: "Quick fit check, drop your questions in the comments 👇" },
  { id: "clip_me_demo_2", sourceId: "clip_kelechi_bts", caption: "Studio day. Ask me anything and I will reply with a video 🎥" },
] as const;

const buildOwnDemoClips = (): Clip[] =>
  DEMO_OWN_CLIPS.flatMap(({ id, sourceId, caption }) => {
    const seed = clipVideoSeeds.find((candidate) => candidate.id === sourceId);
    if (!seed) return [];
    const clip = buildClipFromVideoSeed({ ...seed, id, caption, hoursAgo: 1, likes: 120, comments: 10, views: 2_400 });
    return [{ ...clip, author: userSummaryById("u_me"), isFollowingAuthor: false, subscriberOnly: false, viewerHasAccess: true }];
  });

const allClips: Clip[] = [...buildOwnDemoClips(), ...clipVideoSeeds.map(buildClipFromVideoSeed).map(turnIntoPromotedLiveStream)];

export const appendMockClip = (clip: Clip) => {
  allClips.unshift(clip);
};

const withCurrentSound = (clip: Clip): Clip => ({
  ...withViewerSavedState(clip, "clip"),
  sound: currentSoundForClip(clip.id),
  viewerHasAccess: clip.viewerHasAccess || hasSignedInViewerSubscribedToCreator(clip.author.id),
});

export const findMockClipsByIds = (clipIds: readonly string[]): Clip[] =>
  clipIds.map((clipId) => allClips.find((clip) => clip.id === clipId)).filter((clip): clip is Clip => !!clip && !SUSPENDED_USER_IDS.has(clip.author.id) && isAuthorContentVisibleToSignedInViewer(clip.author.id)).map(withCurrentSound);

const isClipAuthorVisible = (authorId: string) => isAuthorContentVisibleToSignedInViewer(authorId) && !SUSPENDED_USER_IDS.has(authorId);

const listClipsForFeedTab = (tab: string | null): readonly Clip[] => {
  const visibleClips = allClips.filter((clip) => isClipAuthorVisible(clip.author.id));
  return tab === "following" ? visibleClips.filter((clip) => clip.isFollowingAuthor && !clip.sponsored).reverse() : visibleClips;
};

const pageOfClips = (clips: readonly Clip[], cursor: string | null): Page<Clip> => {
  const start = Number(cursor ?? 0) || 0;
  const end = start + CLIPS_PAGE_SIZE;
  return { data: clips.slice(start, end).map(withCurrentSound), nextCursor: end < clips.length ? String(end) : null };
};

export const clipsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/clips", ({ query }) => pageOfClips(listClipsForFeedTab(query.get("tab")), query.get("cursor"))),
];
