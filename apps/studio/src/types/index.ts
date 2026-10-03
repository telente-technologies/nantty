export type ID = string;
export type ISODate = string;

export interface User {
  readonly id: ID;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly email: string | null;
  readonly isCreator: boolean;
  readonly channelHandle: string;
  readonly hasStore: boolean;
}

export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: User;
}

export type LiveState = "idle" | "connecting" | "live" | "ended";

export type LiveCategory = "justChatting" | "gaming" | "music" | "irl" | "education" | "shopping";

export interface LiveGifter {
  readonly id: ID;
  readonly name: string;
  readonly coins: number;
}

export interface LiveBattleResult {
  readonly id: ID;
  readonly opponentName: string;
  readonly coinsFor: number;
  readonly coinsAgainst: number;
}

export interface LiveEarnings {
  readonly coins: number;
  readonly giftCount: number;
  readonly newSubscribers: number;
  readonly topGifters: readonly LiveGifter[];
  readonly battles: readonly LiveBattleResult[];
}

export interface Money {
  readonly amountMinor: number;
  readonly currency: string;
}

export interface LiveProduct {
  readonly id: ID;
  readonly title: string;
  readonly price: Money;
  readonly imageUrl: string | null;
  readonly pinned: boolean;
}

export interface LiveComment {
  readonly id: ID;
  readonly authorName: string;
  readonly text: string;
  readonly createdAt: ISODate;
}

export interface Page<T> {
  readonly data: readonly T[];
  readonly nextCursor: string | null;
}

export interface LiveCommentWire {
  readonly id: ID;
  readonly author: { readonly id: ID; readonly name: string; readonly username: string; readonly avatarUrl: string | null };
  readonly text: string;
  readonly createdAt: ISODate;
}

export interface LiveSession {
  readonly id: ID;
  readonly title: string;
  readonly category: LiveCategory;
  readonly earnings: LiveEarnings;
  readonly state: LiveState;
  readonly createdAt: ISODate;
  readonly startedAt: ISODate | null;
  readonly endedAt: ISODate | null;
  readonly viewers: number;
  readonly peakViewers: number;
  readonly streamKey: string;
  readonly ingestUrl: string;
  readonly hlsUrl: string | null;
  readonly products: readonly LiveProduct[];
  readonly comments: readonly LiveComment[];
}

export type OverlayLayerType = "text" | "image" | "shape" | "countdown" | "ticker";

export interface OverlayLayer {
  readonly id: ID;
  readonly type: OverlayLayerType;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly zIndex: number;
  readonly opacity: number;
  readonly text?: string;
  readonly fontSize?: number;
  readonly color?: string;
  readonly background?: string;
  readonly src?: string;
  readonly radius?: number;
}

export interface OverlayScene {
  readonly id: ID;
  readonly liveId: ID;
  readonly name: string;
  readonly layers: readonly OverlayLayer[];
}
