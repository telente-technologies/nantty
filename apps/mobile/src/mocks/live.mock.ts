import type { LiveCategory, LiveComment, LiveHostRanking, LiveSessionDetails } from "@/types";
import type { LiveMonetizationInput } from "@/types/socialGraph.type";

import { ApiError } from "@/errors/api.error";
import { clipVideoSeeds } from "./clipsVideoCatalog.mock";
import { buildMockUserSummary, getSignedInMockUser } from "./fixtures.mock";
import { productImageUrlsForProduct } from "./mockImages.mock";
import { listProductSummariesInStore, productSummaryByKey } from "./productCatalog.mock";
import { findDirectoryUserById, summariseUser, userSummaryById, type DirectoryUserId } from "./userDirectory.mock";
import { readMockLiveSafety } from "./liveSafety.mock";
import { createMockRoute, mockPage, type MockRoute } from "./registry.mock";

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

const CONTENT_ONLY_LIVE_IDS: ReadonlySet<string> = new Set(["live_olumide_cuts", "live_s2"]);

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

export const buildLiveSession = (liveId: string, host = userSummaryById(findKnownLiveOrDefault(liveId).hostId)): LiveSessionDetails => ({
  id: liveId,
  host: { ...host, followers: findDirectoryUserById(host.id)?.followers ?? 0, following: findDirectoryUserById(host.id)?.following ?? 0 },
  title: findKnownLiveOrDefault(liveId).hostId === host.id ? findKnownLiveOrDefault(liveId).title : "Live on Nantty",
  viewers: 1268,
  status: liveId.startsWith("ended") ? "ended" : "live",
  products: CONTENT_ONLY_LIVE_IDS.has(liveId) ? [] : (["f1", "f2", "f4", "f6"] as const).map((key) => productSummaryByKey(key)),
  isFollowingHost: false,
  startedAt: new Date().toISOString(),
  hostRanking: mockHostRankingFor(liveId),
  ...findStreamPreviewForHost(host.id),
});

const hostedLives = new Map<string, LiveSessionDetails>();
const findRunningHostedLive = (hostId: string) => [...hostedLives.values()].find((session) => session.host.id === hostId && session.status === "live") ?? null;
const issuedStreamKeys = new Map<string, { readonly ingestUrl: string; readonly streamKey: string }>();

const buildStreamCredentials = (liveId: string) => {
  const existing = issuedStreamKeys.get(liveId);
  if (existing) return existing;
  const issued = {
    ingestUrl: "rtmp://creator.nantty.com/live",
    streamKey: `sk_live_${liveId.replace(/[^a-z0-9]/gi, "")}_${Math.random().toString(36).slice(2, 10)}`,
  };
  issuedStreamKeys.set(liveId, issued);
  return issued;
};

export const liveMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/lives/suggested", () =>
    mockPage(
      SUGGESTED_LIVE_SEEDS.map(([userId, title, productKey], index) => ({
        id: `live_s${index}`,
        host: summariseUser(findDirectoryUserById(userId)!),
        title,
        coverUrl: productImageUrlsForProduct(productKey)[0] ?? null,
      })),
    ),
  ),
  createMockRoute("GET", "/api/v1/lives/:liveId", ({ params }) => ({ ...(hostedLives.get(params.liveId!) ?? buildLiveSession(params.liveId!)), safety: readMockLiveSafety(params.liveId!, false) })),
  createMockRoute("POST", "/api/v1/lives", ({ body }) => {
    const monetization = body as Partial<LiveMonetizationInput>;
    if (monetization.liveAdSettings?.allowAds && !monetization.acceptedLiveAdTermsVersion) throw new ApiError(422, "Accept the live-ad terms to allow ads", "LIVE_AD_TERMS_REQUIRED");
    const { storeId = null, productIds = [] } = body as { storeId?: string | null; productIds?: string[] };
    if (productIds.length > 0 && !storeId) throw new ApiError(422, "Start the live for a store to show products.", "PRODUCTS_REQUIRE_STORE");
    if (storeId && storeId !== getSignedInMockUser().storeId) throw new ApiError(403, "You are not a member of this store.", "NOT_STORE_MEMBER");
    const storeProducts = storeId ? listProductSummariesInStore(storeId) : [];
    if (productIds.some((productId) => !storeProducts.some((product) => product.id === productId))) throw new ApiError(403, "That product is not in this store.", "PRODUCT_NOT_IN_STORE");
    const running = findRunningHostedLive(getSignedInMockUser().id);
    if (running) throw new ApiError(409, "You are already live.", "LIVE_ALREADY_RUNNING", undefined, { liveId: running.id });
    const session = {
      ...buildLiveSession(`live_${Date.now()}`, summariseUser(getSignedInMockUser())),
      title: (body as { title: string }).title,
      category: (body as { category?: LiveCategory }).category ?? "justChatting",
      products: storeProducts.filter((product) => productIds.includes(product.id)),
      storeId,
      liveAdSettings: monetization.liveAdSettings ?? null,
      acceptedLiveAdTermsVersion: monetization.acceptedLiveAdTermsVersion ?? null,
      sponsorshipLine: monetization.sponsorshipLine ?? null,
      viewers: 0,
      coverUrl: null,
      playbackUrl: null,
      hostRanking: null,
    };
    hostedLives.set(session.id, session);
    return session;
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/stream-key", ({ params }) => {
    const liveId = params.liveId!;
    const issued = buildStreamCredentials(liveId);
    const session = hostedLives.get(liveId);
    if (session) hostedLives.set(liveId, { ...session, ...issued });
    return issued;
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/join", () => undefined),
  createMockRoute("POST", "/api/v1/lives/:liveId/leave", () => undefined),
  createMockRoute("POST", "/api/v1/lives/:liveId/end", ({ params }) => {
    const session = hostedLives.get(params.liveId!);
    if (session) hostedLives.set(session.id, { ...session, status: "ended", viewers: 0 });
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/heartbeat", ({ params }) => {
    const session = hostedLives.get(params.liveId!);
    const status = session?.status ?? "live";
    return { liveId: params.liveId!, status, leaseExpiresAt: status === "live" ? new Date(Date.now() + 60_000).toISOString() : null, timeoutSeconds: 60 };
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/reactions", () => undefined),
  createMockRoute("POST", "/api/v1/lives/:liveId/share", () => undefined),
  createMockRoute("GET", "/api/v1/lives/:liveId/comments", ({ params }) => ({ data: commentsFor(params.liveId!), nextCursor: null })),
  createMockRoute("POST", "/api/v1/lives/:liveId/comments", ({ params, body }) => {
    const comment: LiveComment = { id: `lc_${Date.now()}`, author: summariseUser(getSignedInMockUser()), text: (body as { text: string }).text, kind: "comment" };
    liveComments.set(params.liveId!, [...commentsFor(params.liveId!), comment]);
    return comment;
  }),
];
