import { ApiError } from "@/errors/api.error";
import { useLocaleStore } from "@/store/locale.store";
import type { LiveGiftGoal, LiveGiftLeaderboardEntry, LiveGiftSentEvent, LiveGiftStreamStats, SendLiveGiftInput, SentLiveGiftReceipt } from "@/types";

import { COIN_CASH_VALUE_MINOR, spendMockCoinsOrThrow } from "./coins.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { findMockLiveGiftById, mockLiveGiftCatalog } from "./giftCatalog.mock";
import { awardMockLivePoints, readMockLivePoints } from "./nanttyPoints.mock";
import { createMockRoute, type MockContext, type MockRoute } from "./registry.mock";

const CREATOR_SHARE_BASIS_POINTS = 7_000;
const COMBO_WINDOW_MS = 3_000;

type LeaderboardUser = LiveGiftLeaderboardEntry["user"];

interface MockLiveGiftLedger {
  giftCount: number;
  totalCoins: number;
  readonly coinsBySupporterId: Map<string, { user: LeaderboardUser; coins: number }>;
  goal: LiveGiftGoal | null;
}

const ledgersByLiveId = new Map<string, MockLiveGiftLedger>();
const combosByKey = new Map<string, { comboId: string; giftId: string; receiverUserId: string; count: number; lastAt: number }>();
const transactionsByIdempotencyKey = new Map<string, SentLiveGiftReceipt>();

const ledgerFor = (liveId: string) => {
  let ledger = ledgersByLiveId.get(liveId);
  if (!ledger) {
    ledger = { giftCount: 0, totalCoins: 0, coinsBySupporterId: new Map(), goal: null };
    ledgersByLiveId.set(liveId, ledger);
  }
  return ledger;
};

const rankLeaderboard = (liveId: string): LiveGiftLeaderboardEntry[] =>
  readMockLivePoints(liveId).map((entry, index) => ({
    rank: index + 1,
    user: entry.user,
    coins: ledgerFor(liveId).coinsBySupporterId.get(entry.user.id)?.coins ?? 0,
    points: entry.points,
  }));

export function recordMockLiveGiftEvent(event: LiveGiftSentEvent, senderUsername: string) {
  const ledger = ledgerFor(event.liveId);
  ledger.giftCount += event.quantity;
  ledger.totalCoins += event.totalCoins;
  const supporter = ledger.coinsBySupporterId.get(event.sender.id);
  ledger.coinsBySupporterId.set(event.sender.id, {
    user: { id: event.sender.id, name: event.sender.name, username: senderUsername, avatarUrl: event.sender.avatarUrl },
    coins: (supporter?.coins ?? 0) + event.totalCoins,
  });
  awardMockLivePoints(event.liveId, { id: event.sender.id, name: event.sender.name, username: senderUsername, avatarUrl: event.sender.avatarUrl }, event.totalCoins);
  const goal = ledger.goal;
  if (goal?.status !== "active") return;
  const progressCoins = goal.progressCoins + event.totalCoins;
  const isCompleted = progressCoins >= goal.targetCoins;
  ledger.goal = { ...goal, progressCoins, status: isCompleted ? "completed" : "active", completedAt: isCompleted ? new Date().toISOString() : null };
}

const nextComboCount = (liveId: string, senderId: string, input: SendLiveGiftInput, receiverUserId: string) => {
  const comboKey = `${liveId}:${senderId}:${input.comboId ?? ""}`;
  const previous = combosByKey.get(comboKey);
  const continues = previous && previous.giftId === input.giftId && previous.receiverUserId === receiverUserId && Date.now() - previous.lastAt < COMBO_WINDOW_MS;
  const combo = { comboId: input.comboId ?? `cmb_${Date.now().toString(36)}`, giftId: input.giftId, receiverUserId, count: (continues ? previous.count : 0) + input.quantity, lastAt: Date.now() };
  combosByKey.set(comboKey, combo);
  return combo;
};

const sendMockLiveGift = (input: SendLiveGiftInput, idempotencyKey: string | undefined): SentLiveGiftReceipt => {
  const replayed = idempotencyKey ? transactionsByIdempotencyKey.get(idempotencyKey) : undefined;
  if (replayed) return replayed;
  const gift = findMockLiveGiftById(input.giftId);
  if (!gift?.isActive) throw new ApiError(404, "Gift not found");
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100) throw new ApiError(400, "Choose between 1 and 100 gifts");
  const sender = getSignedInMockUser();
  const receiverUserId = input.receiverUserId ?? "live_host";
  if (receiverUserId === sender.id) throw new ApiError(422, "You can't send gifts to yourself");
  const totalCoins = gift.priceCoins * input.quantity;
  const coinBalance = spendMockCoinsOrThrow(totalCoins);
  const combo = nextComboCount(input.liveId, sender.id, input, receiverUserId);
  const receipt: SentLiveGiftReceipt = {
    giftTransactionId: `gt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    giftId: gift.id,
    quantity: input.quantity,
    totalCoins,
    receiverUserId,
    comboId: combo.comboId,
    comboCount: combo.count,
    coinBalance,
    battleId: null,
    createdAt: new Date().toISOString(),
  };
  if (idempotencyKey) transactionsByIdempotencyKey.set(idempotencyKey, receipt);
  recordMockLiveGiftEvent(
    {
      type: "gift.sent",
      liveId: input.liveId,
      giftTransactionId: receipt.giftTransactionId,
      giftId: gift.id,
      animationAssetKey: gift.animationAssetKey,
      displayLevel: gift.displayLevel,
      quantity: input.quantity,
      totalCoins,
      sender: { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl },
      receiverUserId,
      comboId: combo.comboId,
      comboCount: combo.count,
    },
    sender.username,
  );
  return receipt;
};

const buildStreamStats = (liveId: string): LiveGiftStreamStats => {
  const ledger = ledgerFor(liveId);
  const currency = useLocaleStore.getState().currency;
  const creatorCoins = Math.floor((ledger.totalCoins * CREATOR_SHARE_BASIS_POINTS) / 10_000);
  return {
    liveId,
    giftCount: ledger.giftCount,
    totalCoins: ledger.totalCoins,
    creatorCoins,
    estimatedEarnings: { amountMinor: creatorCoins * (COIN_CASH_VALUE_MINOR[currency] ?? 1), currency },
    topSupporters: rankLeaderboard(liveId).slice(0, 5),
  };
};

const readGoalInput = ({ body }: MockContext) => {
  const { title, targetCoins, giftId } = body as { title?: string; targetCoins?: number; giftId?: string | null };
  if (title !== undefined && !title.trim()) throw new ApiError(400, "Give the goal a title");
  if (targetCoins !== undefined && (!Number.isInteger(targetCoins) || targetCoins < 10)) throw new ApiError(400, "Set a target of at least 10 coins");
  return { title: title?.trim(), targetCoins, giftId };
};

const updateGoal = (liveId: string, changes: Partial<Pick<LiveGiftGoal, "title" | "targetCoins">>) => {
  const ledger = ledgerFor(liveId);
  if (!ledger.goal) throw new ApiError(404, "Goal not found");
  const merged = { ...ledger.goal, ...Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)) };
  const isCompleted = merged.progressCoins >= merged.targetCoins;
  ledger.goal = { ...merged, status: isCompleted ? "completed" : "active", completedAt: isCompleted ? (ledger.goal.completedAt ?? new Date().toISOString()) : null };
  return ledger.goal;
};

export const giftsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/gifts", () => ({ data: mockLiveGiftCatalog.filter((gift) => gift.isActive), nextCursor: null })),
  createMockRoute("POST", "/api/v1/live/gifts", ({ body, idempotencyKey }) => sendMockLiveGift(body as SendLiveGiftInput, idempotencyKey)),
  createMockRoute("POST", "/api/v1/lives/:liveId/gifts", ({ params, body, idempotencyKey }) =>
    sendMockLiveGift({ ...(body as Omit<SendLiveGiftInput, "liveId">), liveId: params.liveId! }, idempotencyKey),
  ),
  createMockRoute("GET", "/api/v1/lives/:liveId/leaderboard", ({ params, query }) => {
    const limit = Number(query.get("limit") ?? 20);
    const entries = rankLeaderboard(params.liveId!);
    const viewerEntry = entries.find((entry) => entry.user.id === getSignedInMockUser().id);
    return { data: entries.slice(0, limit), nextCursor: null, viewerRank: viewerEntry?.rank ?? null, viewerPoints: viewerEntry?.points ?? 0 };
  }),
  createMockRoute("GET", "/api/v1/creators/me/analytics/gifts/streams/:liveId", ({ params }) => buildStreamStats(params.liveId!)),
  createMockRoute("GET", "/api/v1/lives/:liveId/gift-goals", ({ params }) => {
    const goal = ledgerFor(params.liveId!).goal;
    return { data: goal && goal.status !== "cancelled" ? [goal] : [], nextCursor: null };
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/gift-goals", (context) => {
    const { title, targetCoins, giftId } = readGoalInput(context);
    if (!title || !targetCoins) throw new ApiError(400, "Give the goal a title and a target");
    const ledger = ledgerFor(context.params.liveId!);
    if (ledger.goal?.status === "active") throw new ApiError(409, "Finish or edit your current goal first");
    ledger.goal = { id: `gg_${Date.now().toString(36)}`, liveId: context.params.liveId!, creatorId: getSignedInMockUser().id, title, targetCoins, giftId: giftId ?? null, progressCoins: 0, status: "active", completedAt: null };
    return ledger.goal;
  }),
  createMockRoute("PATCH", "/api/v1/lives/:liveId/gift-goals/:goalId", (context) => {
    const { title, targetCoins } = readGoalInput(context);
    return updateGoal(context.params.liveId!, { title, targetCoins });
  }),
  createMockRoute("DELETE", "/api/v1/lives/:liveId/gift-goals/:goalId", ({ params }) => {
    const ledger = ledgerFor(params.liveId!);
    if (ledger.goal) ledger.goal = { ...ledger.goal, status: "cancelled" };
    return undefined;
  }),
];
