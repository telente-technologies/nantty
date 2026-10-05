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
  readonly expiresIn?: number;
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
  readonly hlsUrl: string | null;
}

export type LiveDetail = Omit<LiveSession, "createdAt">;

export interface StreamKey {
  readonly ingestUrl: string;
  readonly streamKey: string;
}

export interface LiveProductPinWire {
  readonly productId: ID;
  readonly pinned: boolean;
}

export interface StudioLiveWire {
  readonly id: ID;
  readonly title: string;
  readonly category: LiveCategory;
  readonly state: LiveState;
  readonly createdAt: ISODate;
  readonly startedAt: ISODate | null;
  readonly endedAt: ISODate | null;
  readonly viewers: number;
  readonly peakViewers: number;
  readonly streamKeyHint: string | null;
  readonly ingestProtocol: string | null;
  readonly hlsUrl: string | null;
  readonly earnings: { readonly coins: number; readonly giftCount: number };
  readonly recordEnabled: boolean;
  readonly visibility: string;
  readonly products: readonly LiveProductPinWire[];
}

export interface LiveSessionWire {
  readonly id: ID;
  readonly title: string;
  readonly category: LiveCategory;
  readonly state: LiveState;
  readonly viewers: number;
  readonly peakViewers: number;
  readonly startedAt: ISODate | null;
  readonly endedAt: ISODate | null;
  readonly playbackUrl: string | null;
}

export interface StreamKeyWire {
  readonly liveId: ID;
  readonly protocol: string;
  readonly ingestUrl: string;
  readonly streamKey: string;
  readonly streamKeyHint: string;
  readonly issuedAt: ISODate;
}

export interface StreamStatsWire {
  readonly liveId: ID;
  readonly giftCount: number;
  readonly totalCoins: number;
  readonly creatorCoins: number;
  readonly topSupporters: readonly { readonly rank: number; readonly user: { readonly id: ID; readonly name: string; readonly username: string }; readonly coins: number }[];
}

export interface SellerProductWire {
  readonly id: ID;
  readonly name: string;
  readonly status: string;
  readonly images: readonly { readonly url: string }[];
  readonly variants: readonly { readonly price: Money }[];
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

export interface LiveSafetyState {
  readonly state: "paused" | "warning";
  readonly viewerMessage: string;
  readonly heldAt: ISODate | null;
  readonly hostReason?: string;
  readonly category?: string;
  readonly appealable: boolean;
  readonly warningMessage?: string;
  readonly warnedAt?: ISODate;
}

export interface StageGuest {
  readonly slotId: ID;
  readonly role: "host" | "guest";
  readonly state: string;
  readonly user: { readonly id: ID; readonly name: string; readonly username: string; readonly avatarUrl: string | null };
}

export type GuestReportReason = "child_safety" | "self_harm" | "violence" | "sexual_content" | "hate" | "harassment" | "scam" | "intellectual_property" | "other";
