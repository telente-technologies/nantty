import type { LiveComment, LiveSessionDetails } from "@/types";

import { buildMockUserSummary, getSignedInMockUser } from "./fixtures.mock";
import { productImageUrlsForProduct } from "./mockImages.mock";
import { productSummaryByKey } from "./productCatalog.mock";
import { findDirectoryUserById, summariseUser, userSummaryById } from "./userDirectory.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const viewer = (i: number) => buildMockUserSummary(70 + i);

const liveComments = new Map<string, LiveComment[]>();
const seedLiveComments = (): LiveComment[] => [
  { id: "lc_1", author: viewer(1), text: "Does the green print come in UK 14? 😍", kind: "comment" },
  { id: "lc_2", author: viewer(2), text: "Just ordered the wrap dress, can't wait!", kind: "comment" },
  { id: "lc_3", author: viewer(3), text: "joined the live", kind: "joined" },
  { id: "lc_4", author: viewer(4), text: `@${viewer(1).username} yes she has UK 14 in stock`, kind: "reply" },
];
const commentsFor = (liveId: string) => {
  if (!liveComments.has(liveId)) liveComments.set(liveId, seedLiveComments());
  return liveComments.get(liveId)!;
};

const LIVE_HOST_USER_ID = "u_1";

const buildLiveSession = (liveId: string, host = userSummaryById(LIVE_HOST_USER_ID)): LiveSessionDetails => ({
  id: liveId,
  host: { ...host, followers: findDirectoryUserById(host.id)?.followers ?? 0, following: findDirectoryUserById(host.id)?.following ?? 0 },
  title: host.id === LIVE_HOST_USER_ID ? "Owambe Edit try-on 👗 ask me anything" : "Live on Zudomart",
  viewers: 1268,
  status: liveId.startsWith("ended") ? "ended" : "live",
  products: (["f1", "f2", "f4", "f6"] as const).map((key) => productSummaryByKey(key)),
  isFollowingHost: false,
  startedAt: new Date().toISOString(),
});

const hostedLives = new Map<string, LiveSessionDetails>();

export const liveMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/lives/suggested", () =>
    ([
      ["u_2", "Unboxing the new ANC headphones 🎧", "g6"],
      ["u_3", "Harmattan skincare Q&A ✨", "b3"],
      ["u_4", "Cooking ofada stew with mama 🍲", "fd1"],
      ["u_6", "Aba leather workshop tour 👞", "s1"],
      ["u_5", "Back-to-school haul 🎒", "k3"],
      ["u_me", "Clay pot seasoning 101 🏺", "h2"],
    ] as const).map(([userId, title, productKey], index) => ({
      id: `live_s${index}`,
      host: summariseUser(findDirectoryUserById(userId)!),
      title,
      coverUrl: productImageUrlsForProduct(productKey)[0] ?? null,
    })),
  ),
  createMockRoute("GET", "/api/v1/lives/:liveId", ({ params }) => hostedLives.get(params.liveId!) ?? buildLiveSession(params.liveId!)),
  createMockRoute("POST", "/api/v1/lives", ({ body }) => {
    const session = { ...buildLiveSession(`live_${Date.now()}`, summariseUser(getSignedInMockUser())), title: (body as { title: string }).title, viewers: 0 };
    hostedLives.set(session.id, session);
    return session;
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
