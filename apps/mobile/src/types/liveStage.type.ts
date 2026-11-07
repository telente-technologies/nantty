import type { ID, UserSummary } from "./models.type";

export const MAXIMUM_STREAMERS_ON_STAGE = 10;

export type LiveStagePhase = "idle" | "inviting" | "onStage" | "battlePending" | "battleCountdown" | "battling" | "settling" | "result";
export type LiveStageRole = "host" | "guest" | "viewer";
export type LiveStageInviteRole = "speaker" | "cohost";
export type LiveStageLayout = "grid" | "spotlight" | "battle";
export type GuestSlotState = "invited" | "joining" | "onStage" | "reconnecting" | "left" | "removed" | "declined" | "expired" | "cancelled" | "failed";
export type LiveBattleState = "pending" | "countdown" | "active" | "ended" | "settling" | "settled" | "cancelled";
export type LiveBattleParticipantState = "active" | "left" | "forfeited";
export type LiveBattleEndReason = "timer" | "hostEnded" | "hostEndedLive" | "forfeit";

export interface LiveStageStreamer {
  readonly slotId: ID;
  readonly user: UserSummary;
  readonly role: "host" | "guest";
  readonly stageRole?: LiveStageInviteRole;
  readonly title?: string;
  readonly state: GuestSlotState;
  readonly audioMuted: boolean;
  readonly videoMuted: boolean;
  readonly giftEligible: boolean;
  readonly isCreatorProgramMember: boolean;
  readonly position: number;
}

export interface GuestSlot {
  readonly id: ID;
  readonly liveId: ID;
  readonly user: UserSummary;
  readonly stageRole?: LiveStageInviteRole;
  readonly title?: string;
  readonly state: GuestSlotState;
  readonly invitedAt: string;
  readonly expiresAt: string;
  readonly joinedAt?: string;
  readonly leftAt?: string;
  readonly audioMutedByHost: boolean;
  readonly videoMutedByHost: boolean;
  readonly position: number;
}

export interface LiveStageJoinRequest {
  readonly id: ID;
  readonly user: UserSummary;
  readonly state: "pending" | "approved" | "declined";
  readonly requestedAt: string;
}

export interface LiveBattleGifter {
  readonly userId: ID;
  readonly user: UserSummary;
  readonly coins: number;
}

export interface LiveBattleParticipant {
  readonly userId: ID;
  readonly user: UserSummary;
  readonly score: number;
  readonly rank: number;
  readonly state: LiveBattleParticipantState;
  readonly topGifters: readonly LiveBattleGifter[];
}

export interface LiveBattleTransfer {
  readonly fromUserId: ID;
  readonly toUserId: ID;
  readonly coins: number;
}

export interface LiveBattlePayout {
  readonly userId: ID;
  readonly score: number;
  readonly earnedCoins: number;
  readonly paidToUserId: ID;
}

export type LiveBattleConsentState = "pending" | "accepted" | "declined";

export interface LiveBattleProposal {
  readonly id: ID;
  readonly winnerTakesAll: true;
  readonly durationSeconds: number;
  readonly participants: readonly UserSummary[];
  readonly consents: readonly { readonly userId: ID; readonly state: LiveBattleConsentState }[];
  readonly expiresAt: string;
  readonly needsHostDecision: boolean;
}

export interface LiveBattle {
  readonly id: ID;
  readonly liveId: ID;
  readonly state: LiveBattleState;
  readonly winnerTakesAll: boolean;
  readonly durationSeconds: number;
  readonly countdownStartedAt: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly settledAt: string | null;
  readonly celebrationEndsAt: string;
  readonly participants: readonly LiveBattleParticipant[];
  readonly winnerUserIds: readonly ID[];
  readonly isTie: boolean;
  readonly endReason: LiveBattleEndReason | null;
  readonly mvpGifter: LiveBattleGifter | null;
  readonly transfers: readonly LiveBattleTransfer[];
  readonly payouts: readonly LiveBattlePayout[];
}

export interface LiveBattleGiftEvent {
  readonly id: ID;
  readonly sender: UserSummary;
  readonly recipientUserId: ID;
  readonly giftEmoji: string;
  readonly coins: number;
}

export interface LiveStage {
  readonly liveId: ID;
  readonly layout: LiveStageLayout;
  readonly phase: LiveStagePhase;
  readonly serverNow: string;
  readonly myRole: LiveStageRole;
  readonly streamers: readonly LiveStageStreamer[];
  readonly invitations: readonly GuestSlot[];
  readonly joinRequests: readonly LiveStageJoinRequest[];
  readonly invitationForMe: GuestSlot | null;
  readonly myJoinRequest: LiveStageJoinRequest | null;
  readonly battleProposal: LiveBattleProposal | null;
  readonly activeBattle: LiveBattle | null;
  readonly recentBattleGifts: readonly LiveBattleGiftEvent[];
  readonly battleHistory: readonly LiveBattle[];
}

export interface CreateLiveBattleInput {
  readonly participantUserIds: readonly ID[];
  readonly durationSeconds: number;
  readonly winnerTakesAll: boolean;
}

export interface MuteStreamerInput {
  readonly audio?: boolean;
  readonly video?: boolean;
}

export interface SendLiveBattleCoinsInput {
  readonly recipientUserId: ID;
  readonly coins: number;
}
