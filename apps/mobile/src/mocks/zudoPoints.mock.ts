import { ApiError } from "@/errors/api.error";
import type { LiveGiftLeaderboardEntry } from "@/types";
import type { LivePointsAction, LivePointsAward, RankingBoard, RankingEntry } from "@/types/socialGraph.type";

import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { directoryUsersExcludingAccounts, summariseUser } from "./userDirectory.mock";

const LIKE_POINTS_CAP_PER_MINUTE = 10;
const LIKE_WINDOW_MS = 60_000;
const WATCH_INTERVAL_MS = 55_000;
const ONCE_PER_LIVE_POINTS = { share: 5, follow: 10 } as const;
const SEEDED_SUPPORTERS: readonly (readonly [string, number])[] = [["u_7", 120], ["u_8", 85], ["u_10", 40]];

type LeaderboardUser = LiveGiftLeaderboardEntry["user"];

interface LivePointsBoard {
  readonly pointsByUserId: Map<string, { user: LeaderboardUser; points: number }>;
  readonly likeTimestampsByUserId: Map<string, number[]>;
  readonly onceActionsByUserId: Map<string, Set<string>>;
  readonly lastWatchAtByUserId: Map<string, number>;
}

const boardsByLiveId = new Map<string, LivePointsBoard>();

const toLeaderboardUser = (user: { id: string; name: string; username: string; avatarUrl: string | null }): LeaderboardUser => ({
  id: user.id,
  name: user.name,
  username: user.username,
  avatarUrl: user.avatarUrl,
});

const boardFor = (liveId: string): LivePointsBoard => {
  let board = boardsByLiveId.get(liveId);
  if (!board) {
    board = { pointsByUserId: new Map(), likeTimestampsByUserId: new Map(), onceActionsByUserId: new Map(), lastWatchAtByUserId: new Map() };
    for (const [userId, points] of SEEDED_SUPPORTERS) {
      const user = directoryUsersExcludingAccounts.find((candidate) => candidate.id === userId);
      if (user) board.pointsByUserId.set(userId, { user: toLeaderboardUser(summariseUser(user)), points });
    }
    boardsByLiveId.set(liveId, board);
  }
  return board;
};

export const awardMockLivePoints = (liveId: string, user: LeaderboardUser, amount: number) => {
  const board = boardFor(liveId);
  const current = board.pointsByUserId.get(user.id);
  board.pointsByUserId.set(user.id, { user, points: (current?.points ?? 0) + amount });
};

export const readMockLivePoints = (liveId: string) => {
  const board = boardFor(liveId);
  return [...board.pointsByUserId.values()].sort((a, b) => b.points - a.points);
};

const likePointsInLastMinute = (board: LivePointsBoard, userId: string) => {
  const recent = (board.likeTimestampsByUserId.get(userId) ?? []).filter((at) => Date.now() - at < LIKE_WINDOW_MS);
  board.likeTimestampsByUserId.set(userId, recent);
  return recent.length;
};

const calculateAwardForAction = (board: LivePointsBoard, userId: string, action: LivePointsAction): number => {
  if (action === "like") {
    if (likePointsInLastMinute(board, userId) >= LIKE_POINTS_CAP_PER_MINUTE) return 0;
    board.likeTimestampsByUserId.get(userId)!.push(Date.now());
    return 1;
  }
  if (action === "watch") {
    if (Date.now() - (board.lastWatchAtByUserId.get(userId) ?? 0) < WATCH_INTERVAL_MS) return 0;
    board.lastWatchAtByUserId.set(userId, Date.now());
    return 2;
  }
  const done = board.onceActionsByUserId.get(userId) ?? new Set<string>();
  board.onceActionsByUserId.set(userId, done);
  if (done.has(action)) return 0;
  done.add(action);
  return ONCE_PER_LIVE_POINTS[action];
};

const awardEngagement = (liveId: string, action: LivePointsAction): LivePointsAward => {
  if (!["like", "share", "follow", "watch"].includes(action)) throw new ApiError(400, "Unknown engagement action");
  const board = boardFor(liveId);
  const viewer = getSignedInMockUser();
  const awarded = calculateAwardForAction(board, viewer.id, action);
  if (awarded > 0) awardMockLivePoints(liveId, toLeaderboardUser(viewer), awarded);
  return { awarded, totalPoints: board.pointsByUserId.get(viewer.id)?.points ?? 0, likePointsThisMinute: likePointsInLastMinute(board, viewer.id) };
};

const hashText = (text: string) => [...text].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 100_003, 7);

const buildRankings = (board: RankingBoard, scope: string, qualifier: string): RankingEntry[] =>
  directoryUsersExcludingAccounts
    .map((user) => ({ user: summariseUser(user), points: 500 + (hashText(`${user.id}:${board}:${scope}:${qualifier}`) % 9_500) }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 20)
    .map((entry, index) => ({ rank: index + 1, ...entry }));

export const zudoPointsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/lives/:liveId/points/me", ({ params }) => {
    const board = boardFor(params.liveId!);
    const viewerId = getSignedInMockUser().id;
    return { totalPoints: board.pointsByUserId.get(viewerId)?.points ?? 0, likePointsThisMinute: likePointsInLastMinute(board, viewerId) };
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/engagement", ({ params, body }) => awardEngagement(params.liveId!, (body as { action: LivePointsAction }).action)),
  createMockRoute("GET", "/api/v1/rankings", ({ query }) => ({
    data: buildRankings((query.get("board") ?? "supporter") as RankingBoard, query.get("scope") ?? "global", query.get("countryCode") ?? query.get("categoryId") ?? ""),
    nextCursor: null,
  })),
];
