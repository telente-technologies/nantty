import { ApiError } from "@/errors/api.error";
import type { Page, Post } from "@/types";

import { isoDateHoursAgo } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { withViewerBookmarkState } from "./saveState.mock";
import { isFollowingUser } from "./socialGraph.mock";
import { userSummaryById, type DirectoryUserId } from "./userDirectory.mock";

export const BLENDER_OPEN_MOVIES_LICENSE = "Creative Commons Attribution — Blender Foundation open movies (peach, durian and mango.blender.org)";

interface VideoSeed {
  readonly id: string;
  readonly authorId: DirectoryUserId;
  readonly videoUrl: string;
  readonly posterUrl: string;
  readonly caption: string;
  readonly durationSeconds: number;
  readonly hoursAgo: number;
  readonly engagement: readonly [number, number, number, number];
}

const videoSeeds: readonly VideoSeed[] = [
  {
    id: "video_bunny",
    authorId: "u_9",
    videoUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.720p.vp9.webm",
    posterUrl: "https://peach.blender.org/wp-content/uploads/bbb-splash.png",
    caption: "Sunday cartoon break: Big Buck Bunny, the Blender open movie that taught me lighting. Watch to the end 🐰",
    durationSeconds: 634,
    hoursAgo: 5,
    engagement: [3_420, 212, 88, 61_000],
  },
  {
    id: "video_sintel",
    authorId: "u_15",
    videoUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f1/Sintel_movie_4K.webm/Sintel_movie_4K.webm.720p.vp9.webm",
    posterUrl: "https://durian.blender.org/wp-content/uploads/2010/06/05.8b_comp_000272.jpg",
    caption: "Rewatching Sintel before my Jos trip. Those mountain shots are my whole moodboard 🏔️",
    durationSeconds: 888,
    hoursAgo: 19,
    engagement: [2_180, 140, 51, 38_400],
  },
  {
    id: "video_steel",
    authorId: "u_7",
    videoUrl: "https://download.blender.org/demo/movies/ToS/tears_of_steel_720p.mov",
    posterUrl: "https://mango.blender.org/wp-content/uploads/2013/05/01_thom_celia_bridge.jpg",
    caption: "Tears of Steel is proof you can ship VFX with open-source tools. Breakdown thread in the comments 🤖",
    durationSeconds: 734,
    hoursAgo: 33,
    engagement: [1_760, 96, 40, 24_900],
  },
];

const buildVideoPostFromSeed = (seed: VideoSeed): Post => {
  const [likes, comments, reposts, views] = seed.engagement;
  return {
    id: seed.id,
    kind: "post",
    author: userSummaryById(seed.authorId),
    createdAt: isoDateHoursAgo(seed.hoursAgo),
    text: seed.caption,
    media: [
      {
        type: "video",
        url: seed.videoUrl,
        posterUrl: seed.posterUrl,
        width: 1280,
        height: 720,
        durationSeconds: seed.durationSeconds,
        status: "ready",
      },
    ],
    likes,
    comments,
    reposts,
    views,
    liked: false,
    bookmarked: false,
    saveCount: 0,
    isFollowingAuthor: isFollowingUser(seed.authorId),
    friendsLiked: null,
    products: [],
  };
};

const allVideoPosts: readonly Post[] = videoSeeds.map(buildVideoPostFromSeed);

export const findMockVideoById = (videoId: string): Post | undefined => {
  const video = allVideoPosts.find((post) => post.id === videoId);
  return video ? withViewerBookmarkState(video, "video") : undefined;
};

export const findMockVideoForFeedPage = (pageIndex: number): Post | undefined => {
  const video = allVideoPosts[pageIndex];
  return video ? withViewerBookmarkState(video, "video") : undefined;
};

const pageOfVideos = (cursor: string | null): Page<Post> => {
  const start = Number(cursor ?? 0) || 0;
  const end = start + 6;
  return { data: allVideoPosts.slice(start, end).map((post) => withViewerBookmarkState(post, "video")), nextCursor: end < allVideoPosts.length ? String(end) : null };
};

export const videosMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/videos", ({ query }) => pageOfVideos(query.get("cursor"))),
  createMockRoute("GET", "/api/v1/videos/:videoId", ({ params }) => {
    const video = findMockVideoById(params.videoId!);
    if (!video) throw new ApiError(404, "This video was removed");
    return video;
  }),
];
