import { ApiError } from "@/errors/api.error";
import type { LiveComment, LiveHostRanking, LiveSafetyState, LiveSessionDetails } from "@/types";

import { clipVideoSeeds } from "./clipsVideoCatalog.mock";
import { buildMockUserSummary, getSignedInMockUser } from "./fixtures.mock";
import { productImageUrlsForProduct } from "./mockImages.mock";
import { productSummaryByKey } from "./productCatalog.mock";
import { findDirectoryUserById, summariseUser, userSummaryById, type DirectoryUserId } from "./userDirectory.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const MOCK_PAUSED_LIVE_ID = "live_safety_paused";

function readMockLiveSafety(liveId: string): LiveSafetyState | null {
  if (liveId !== MOCK_PAUSED_LIVE_ID) return null;
  return { state: "paused", viewerMessage: "This live is paused while we review it", heldAt: new Date(Date.now() - 90_000).toISOString(), appealable: true };
}

const viewer = (i: number) => buildMockUserSummary(70 + i);

const liveComments = new Map<string, LiveComment[]>();
const seedLiveComments = (): LiveComment[] => [
  { id: "lc_1", author: viewer(1), text: "Does the green print come in UK 14? 😍", kind: "comment" },
  { id: "lc_2", author: viewer(2), text: "Just ordered the wrap dress, can't wait!", kind: "comment" },
  { id: "lc_3", author: viewer(3), text: "", kind: "joined" },
  { id: "lc_4", author: viewer(4), text: `@${viewer(1).username} yes she has UK 14 in stock`, kind: "reply" },
];
const commentsFor = (liveId: string) => {
  if (!liveComments.has(liveId)) liveComments.set(liveId, seedLiveComments());
  return liveComments.get(liveId)!;
};

const LIVE_HOST_USER_ID: DirectoryUserId = "u_1";

const SUGGESTED_LIVE_SEEDS = [
  ["u_2", "Unboxing the new ANC headphones 🎧", "g6"],
  ["u_3", "Harmattan skincare Q&A ✨", "b3"],
  ["u_4", "Cooking ofada stew with mama 🍲", "fd1"],
  ["u_6", "Aba leather workshop tour 👞", "s1"],
  ["u_5", "Back-to-school haul 🎒", "k3"],
  ["u_me", "Clay pot seasoning 101 🏺", "h2"],
] as const;

const DEFAULT_LIVE: { hostId: DirectoryUserId; title: string } = { hostId: LIVE_HOST_USER_ID, title: "Owambe Edit try-on 👗 ask me anything" };

const KNOWN_LIVES_BY_ID: Readonly<Record<string, { hostId: DirectoryUserId; title: string }>> = {
  live_olumide_cuts: { hostId: "u_14", title: "Friday fade specials" },
  ...Object.fromEntries(SUGGESTED_LIVE_SEEDS.map(([hostId, title], index) => [`live_s${index}`, { hostId, title }])),
};

export const findMockLiveIdForHost = (hostId: string): string | null =>
  Object.entries(KNOWN_LIVES_BY_ID).find(([, live]) => live.hostId === hostId)?.[0] ?? null;

const findKnownLiveOrDefault = (liveId: string) => KNOWN_LIVES_BY_ID[liveId] ?? DEFAULT_LIVE;

const MOCK_HOST_RANKINGS: Readonly<Record<string, LiveHostRanking>> = {
  live_olumide_cuts: { globalRank: 2, categoryRank: 1, category: "irl", period: "week" },
  live_s0: { globalRank: 1, categoryRank: 1, category: "shopping", period: "week" },
  live_s1: { globalRank: 7, categoryRank: 3, category: "shopping", period: "week" },
  live_s3: { globalRank: 64, categoryRank: 12, category: "music", period: "week" },
  live_s4: { globalRank: 318, categoryRank: null, category: null, period: "week" },
};

const DEFAULT_LIVE_HOST_RANKING: LiveHostRanking = { globalRank: 12, categoryRank: 3, category: "shopping", period: "week" };

const mockHostRankingFor = (liveId: string): LiveHostRanking | null =>
  MOCK_HOST_RANKINGS[liveId] ?? (KNOWN_LIVES_BY_ID[liveId] ? null : DEFAULT_LIVE_HOST_RANKING);

const findStreamPreviewForHost = (hostId: string) => {
  const hostClip = clipVideoSeeds.find((seed) => seed.authorId === hostId);
  return { coverUrl: hostClip?.posterUrl ?? null, playbackUrl: hostClip?.videoUrl ?? null };
};

const buildLiveSession = (liveId: string, host = userSummaryById(findKnownLiveOrDefault(liveId).hostId)): LiveSessionDetails => ({
  id: liveId,
  host: { ...host, followers: findDirectoryUserById(host.id)?.followers ?? 0, following: findDirectoryUserById(host.id)?.following ?? 0 },
  title: findKnownLiveOrDefault(liveId).hostId === host.id ? findKnownLiveOrDefault(liveId).title : "Live on Zudomart",
  viewers: 1268,
  status: liveId.startsWith("ended") ? "ended" : "live",
  products: (["f1", "f2", "f4", "f6"] as const).map((key) => productSummaryByKey(key)),
  isFollowingHost: false,
  startedAt: new Date().toISOString(),
  hostRanking: mockHostRankingFor(liveId),
  ...findStreamPreviewForHost(host.id),
});

const hostedLives = new Map<string, LiveSessionDetails>();

export const liveMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/lives/suggested", () => ({
    data: SUGGESTED_LIVE_SEEDS.map(([userId, title, productKey], index) => ({
      id: `live_s${index}`,
      host: summariseUser(findDirectoryUserById(userId)!),
      title,
      coverUrl: productImageUrlsForProduct(productKey)[0] ?? null,
    })),
    nextCursor: null,
  })),
  createMockRoute("GET", "/api/v1/lives/:liveId", ({ params }) => ({ ...(hostedLives.get(params.liveId!) ?? buildLiveSession(params.liveId!)), safety: readMockLiveSafety(params.liveId!) })),
  createMockRoute("GET", "/api/v1/lives/:liveId/safety", ({ params }) => ({ safety: readMockLiveSafety(params.liveId!) })),
  createMockRoute("POST", "/api/v1/live-safety/:liveId/appeal", ({ params }) => ({ status: "received", incidentId: `inc_${params.liveId!}` })),
  createMockRoute("POST", "/api/v1/lives", ({ body }) => {
    const session = {
      ...buildLiveSession(`live_${Date.now()}`, summariseUser(getSignedInMockUser())),
      title: (body as { title: string }).title,
      viewers: 0,
      coverUrl: null,
      playbackUrl: null,
      hostRanking: null,
    };
    hostedLives.set(session.id, session);
    return session;
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/media-token", () => {
    throw new ApiError(409, "Live video isn't streamed in mock mode, so you see the cover photo.", "LIVE_VIDEO_MOCK_PREVIEW");
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/join", () => undefined),
  createMockRoute("POST", "/api/v1/lives/:liveId/leave", () => undefined),
  createMockRoute("POST", "/api/v1/lives/:liveId/end", () => undefined),
  createMockRoute("POST", "/api/v1/lives/:liveId/reactions", () => undefined),
  createMockRoute("POST", "/api/v1/lives/:liveId/share", () => undefined),
  createMockRoute("GET", "/api/v1/lives/:liveId/comments", ({ params }) => ({ data: commentsFor(params.liveId!), nextCursor: null })),
  createMockRoute("POST", "/api/v1/lives/:liveId/comments", ({ params, body }) => {
    const comment: LiveComment = { id: `lc_${Date.now()}`, author: summariseUser(getSignedInMockUser()), text: (body as { text: string }).text, kind: "comment" };
    liveComments.set(params.liveId!, [...commentsFor(params.liveId!), comment]);
    return comment;
  }),
];
