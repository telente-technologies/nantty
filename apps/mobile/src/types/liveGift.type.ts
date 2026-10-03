import type { ID, ISODate } from "./models.type";
import type { Money } from "./money.type";

export type LiveGiftTier = "basic" | "premium" | "legendary";
export type LiveGiftDisplayLevel = "micro" | "medium" | "large" | "global";
export type LiveGiftAnimationEngine = "alphaVideo" | "lottie" | "pag" | "spriteSheet";
export type LiveGiftHaptic = "light" | "medium" | "heavy" | "pattern";

export interface LiveGift {
  readonly id: ID;
  readonly name: string;
  readonly description?: string;
  readonly tier: LiveGiftTier;
  readonly priceCoins: number;
  readonly animationEngine: LiveGiftAnimationEngine;
  readonly animationAssetKey: string;
  readonly previewAssetKey: string;
  readonly durationMs: number;
  readonly displayLevel: LiveGiftDisplayLevel;
  readonly sound?: string | null;
  readonly haptic?: LiveGiftHaptic | null;
  readonly comboable: boolean;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SendLiveGiftInput {
  readonly liveId: ID;
  readonly giftId: ID;
  readonly quantity: number;
  readonly receiverUserId?: ID;
  readonly comboId?: string;
}

export interface SentLiveGiftReceipt {
  readonly giftTransactionId: ID;
  readonly giftId: ID;
  readonly quantity: number;
  readonly totalCoins: number;
  readonly receiverUserId: ID;
  readonly comboId: string;
  readonly comboCount: number;
  readonly coinBalance: number;
  readonly battleId?: ID | null;
  readonly createdAt: ISODate;
}

export interface LiveGiftSender {
  readonly id: ID;
  readonly name: string;
  readonly avatarUrl: string | null;
}

export interface LiveGiftSentEvent {
  readonly type: "gift.sent";
  readonly liveId: ID;
  readonly giftTransactionId: ID;
  readonly giftId: ID;
  readonly animationAssetKey: string;
  readonly displayLevel: LiveGiftDisplayLevel;
  readonly quantity: number;
  readonly totalCoins: number;
  readonly sender: LiveGiftSender;
  readonly receiverUserId: ID;
  readonly comboId: string;
  readonly comboCount: number;
  readonly battleId?: ID | null;
}

export interface LiveGiftLeaderboardEntry {
  readonly rank: number;
  readonly user: { readonly id: ID; readonly name: string; readonly username: string; readonly avatarUrl: string | null };
  readonly coins: number;
  readonly points: number;
}

export interface LiveGiftLeaderboard {
  readonly data: readonly LiveGiftLeaderboardEntry[];
  readonly nextCursor?: string | null;
  readonly viewerRank?: number | null;
  readonly viewerPoints?: number;
}

export type LiveGiftGoalStatus = "active" | "completed" | "cancelled";

export interface LiveGiftGoal {
  readonly id: ID;
  readonly liveId: ID;
  readonly creatorId: ID;
  readonly title: string;
  readonly targetCoins: number;
  readonly giftId?: ID | null;
  readonly progressCoins: number;
  readonly status: LiveGiftGoalStatus;
  readonly completedAt: ISODate | null;
}

export interface LiveGiftStreamStats {
  readonly liveId: ID;
  readonly giftCount: number;
  readonly totalCoins: number;
  readonly creatorCoins: number;
  readonly estimatedEarnings: Money | null;
  readonly topSupporters: readonly LiveGiftLeaderboardEntry[];
}
