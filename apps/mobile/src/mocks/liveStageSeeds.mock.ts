import type { LiveGift, LiveSessionDetails, UserSummary } from "@/types";
import type {
  GuestSlot,
  LiveBattle,
  LiveBattleEndReason,
  LiveBattleGiftEvent,
  LiveBattleGifter,
  LiveBattleConsentState,
  LiveBattleParticipantState,
  LiveBattlePayout,
  LiveBattleTransfer,
  LiveStageJoinRequest,
  LiveStageStreamer,
} from "@/types/liveStage.type";

import { buildMockUserSummary } from "./fixtures.mock";
import { giftsMocks } from "./gifts.mock";
import { liveMocks } from "./live.mock";
import type { MockRoute } from "./registry.mock";

export interface MockBattleParticipant {
  readonly user: UserSummary;
  score: number;
  state: LiveBattleParticipantState;
  keepsOwnCoinsUnderWinnerTakesAll: boolean;
  readonly isCreatorProgramMember: boolean;
  readonly gifters: Map<string, LiveBattleGifter>;
}

export interface MockBattleSettlement {
  readonly winnerUserIds: string[];
  readonly isTie: boolean;
  readonly transfers: LiveBattleTransfer[];
  readonly payouts: LiveBattlePayout[];
  readonly mvpGifter: LiveBattleGifter | null;
}

export interface MockBattle {
  readonly id: string;
  readonly liveId: string;
  readonly winnerTakesAll: boolean;
  readonly durationSeconds: number;
  readonly countdownStartedAt: number;
  readonly startsAt: number;
  endsAt: number;
  settledAt: number;
  celebrationEndsAt: number;
  endReason: LiveBattleEndReason | null;
  simulatedThroughSecond: number;
  readonly participants: MockBattleParticipant[];
  settlement: MockBattleSettlement | null;
}

export interface MockGuestSlot extends Omit<GuestSlot, "state"> {
  state: GuestSlot["state"];
  readonly resolvesAt: number;
  readonly willAccept: boolean;
  readonly isForMe: boolean;
}

export interface MockJoinRequest extends Omit<LiveStageJoinRequest, "state"> {
  state: LiveStageJoinRequest["state"];
  readonly autoApprovesAt: number | null;
}

export interface MockBattleProposal {
  readonly id: string;
  readonly durationSeconds: number;
  readonly participants: UserSummary[];
  readonly consents: Map<string, LiveBattleConsentState>;
  readonly simulatedResponseAt: number;
  readonly expiresAt: number;
  hostDecisionAt: number | null;
}

export interface MockStage {
  readonly liveId: string;
  readonly host: UserSummary;
  readonly isHostedByMe: boolean;
  readonly openedAt: number;
  streamers: LiveStageStreamer[];
  invitations: MockGuestSlot[];
  joinRequests: MockJoinRequest[];
  battleProposal: MockBattleProposal | null;
  battle: MockBattle | null;
  battleHistory: LiveBattle[];
  recentBattleGifts: LiveBattleGiftEvent[];
  battlesStarted: number;
  slotsCreated: number;
  nextAutoBattleAt: number | null;
  hasHostInvitedMe: boolean;
  simulatedJoinRequestsSent: number;
}

export const BATTLE_COUNTDOWN_MS = 3_000;
export const BATTLE_SETTLING_MS = 2_000;
export const BATTLE_RESULT_MS = 10_000;
export const INVITE_RESPONSE_DELAY_MS = 2_500;
export const INVITE_EXPIRY_MS = 60_000;
export const BATTLE_CONSENT_TIMEOUT_MS = 15_000;
export const SIMULATED_CONSENT_DELAY_MS = 2_000;
export const VIEWER_REQUEST_AUTO_APPROVE_MS = 3_000;
export const HOST_INVITES_VIEWER_AFTER_MS = 20_000;
export const SIMULATED_JOIN_REQUEST_OFFSETS_MS = [12_000, 40_000, 90_000] as const;

export const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const hashTextToSeed = (text: string) => [...text].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) | 0, 7);

export const mockAudienceUser = (index: number) => buildMockUserSummary(30 + index);
export const MOCK_AUDIENCE_SIZE = 24;
export const listMockAudienceUsers = () => Array.from({ length: MOCK_AUDIENCE_SIZE }, (_, index) => mockAudienceUser(index));

const invokeMockGetRoute = <T>(routes: readonly MockRoute[], path: string, params: Record<string, string>): T => {
  const route = routes.find((candidate) => candidate.method === "GET" && candidate.path === path)!;
  return route.handler({ params, query: new URLSearchParams(), body: undefined }) as T;
};

export const readMockLiveSession = (liveId: string) => invokeMockGetRoute<LiveSessionDetails>(liveMocks, "/api/v1/lives/:liveId", { liveId });
export const readMockGiftCatalog = (): LiveGift[] => {
  const catalog = invokeMockGetRoute<LiveGift[] | { data: LiveGift[] }>(giftsMocks, "/api/v1/gifts", {});
  return Array.isArray(catalog) ? catalog : catalog.data;
};

export const describeGiftGlyph = (gift: LiveGift) => (gift as LiveGift & { emoji?: string }).emoji ?? "🎁";

export const SIMULATED_GIFT_WEIGHTS: Readonly<Record<string, number>> = {
  gift_rose: 40,
  gift_jollof: 25,
  gift_heart: 18,
  gift_crown: 10,
  gift_rocket: 5,
  gift_lion: 2,
};

export const pickWeightedSimulatedGift = (random: () => number) => {
  const catalog = readMockGiftCatalog();
  const total = catalog.reduce((sum, gift) => sum + (SIMULATED_GIFT_WEIGHTS[gift.id] ?? 1), 0);
  let roll = random() * total;
  for (const gift of catalog) {
    roll -= SIMULATED_GIFT_WEIGHTS[gift.id] ?? 1;
    if (roll <= 0) return gift;
  }
  return catalog[0]!;
};

export const isMockCreatorProgramMember = (user: UserSummary) => user.isCreator === true || Math.abs(hashTextToSeed(user.id)) % 3 !== 0;

export const willSimulatedStreamerDeclineWinnerTakesAll = (userId: string) => Math.abs(hashTextToSeed(userId)) % 5 === 4;

export const buildStreamer = (user: UserSummary, role: "host" | "guest", slotId: string): LiveStageStreamer => ({
  slotId,
  user,
  role,
  state: "onStage",
  audioMuted: false,
  videoMuted: false,
  giftEligible: true,
  isCreatorProgramMember: role === "host" || isMockCreatorProgramMember(user),
  position: 0,
});

export const seededGuestCountForLive = (liveId: string) => (liveId === "live_s1" ? 5 : liveId === "live_s2" ? 3 : 1);
