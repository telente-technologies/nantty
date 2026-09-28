import type { LiveComment, LiveSessionDetails } from "@/types";

import { clipsMocks } from "./clips.mock";
import { buildMockUserSummary, me } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const viewer = (i: number) => ({ ...buildMockUserSummary(70 + i), username: "user-name" });

const liveComments = new Map<string, LiveComment[]>();
const seedLiveComments = (): LiveComment[] => [
  { id: "lc_1", author: viewer(1), text: "comment about the live stream here from the viewer", kind: "comment" },
  { id: "lc_2", author: viewer(2), text: "comment about the live stream", kind: "comment" },
  { id: "lc_3", author: viewer(3), text: "the live stream", kind: "joined" },
  { id: "lc_4", author: viewer(4), text: "@user-name on the live stream", kind: "reply" },
];
const commentsFor = (liveId: string) => {
  if (!liveComments.has(liveId)) liveComments.set(liveId, seedLiveComments());
  return liveComments.get(liveId)!;
};

const buildLiveSession = (liveId: string, host = { ...buildMockUserSummary(80, "Live Username") }): LiveSessionDetails => ({
  id: liveId,
  host: { ...host, followers: 200, following: 300 },
  title: "Title of Live here",
  viewers: 268,
  status: liveId.startsWith("ended") ? "ended" : "live",
  products: [1, 2, 3, 4].map((n) => ({ id: `pr_${n}`, name: "Product Name", price: 2_000_000, imageUrl: null })),
  isFollowingHost: false,
  startedAt: new Date().toISOString(),
});

const hostedLives = new Map<string, LiveSessionDetails>();

export const liveMocks: MockRoute[] = [
  ...clipsMocks,
  createMockRoute("GET", "/api/v1/lives/suggested", () =>
    Array.from({ length: 6 }, (_, i) => ({ id: `live_s${i}`, host: buildMockUserSummary(90 + i), title: "Live", coverUrl: null })),
  ),
  createMockRoute("GET", "/api/v1/lives/:liveId", ({ params }) => hostedLives.get(params.liveId!) ?? buildLiveSession(params.liveId!)),
  createMockRoute("POST", "/api/v1/lives", ({ body }) => {
    const session = { ...buildLiveSession(`live_${Date.now()}`, me), title: (body as { title: string }).title, viewers: 0 };
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
    const comment: LiveComment = { id: `lc_${Date.now()}`, author: me, text: (body as { text: string }).text, kind: "comment" };
    liveComments.set(params.liveId!, [...commentsFor(params.liveId!), comment]);
    return comment;
  }),
];
