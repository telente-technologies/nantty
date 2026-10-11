import type { Money } from "./money.type";
import type { WidgetKind } from "@/config/widgets.config";

export interface OrderWidgetItem {
  readonly id: string;
  readonly reference: string;
  readonly status: string;
  readonly statusLabel: string;
  readonly etaAt: string | null;
  readonly itemTitle: string;
  readonly itemCount: number;
  readonly imageUrl: string | null;
  readonly storeName: string;
  readonly deepLink: string;
}

export interface OrderWidgetPayload {
  readonly orders: readonly OrderWidgetItem[];
  readonly activeCount: number;
  readonly generatedAt: string;
}

export interface SellerTodayWidgetPayload {
  readonly storeName: string;
  readonly salesToday: Money | null;
  readonly ordersToday: number;
  readonly ordersToShip: number;
  readonly availableBalance: Money | null;
  readonly amountsHidden: boolean;
  readonly deepLink: string;
  readonly generatedAt: string;
}

export interface LiveNowWidgetItem {
  readonly id: string;
  readonly hostId: string;
  readonly hostName: string;
  readonly hostUsername: string;
  readonly hostAvatarUrl: string | null;
  readonly title: string;
  readonly viewers: number;
  readonly deepLink: string;
}

export interface LiveNowWidgetPayload {
  readonly lives: readonly LiveNowWidgetItem[];
  readonly generatedAt: string;
}

export interface CreatorTodayWidgetPayload {
  readonly creatorProgramMember: boolean;
  readonly viewsToday: number;
  readonly newFollowersToday: number;
  readonly earningsToday: Money | null;
  readonly amountsHidden: boolean;
  readonly deepLink: string;
  readonly generatedAt: string;
}

export interface StoryWidgetPerson {
  readonly userId: string;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly hasUnseen: boolean;
  readonly storyCount: number;
  readonly latestStoryAt: string;
  readonly thumbnailUrl: string | null;
  readonly deepLink: string;
}

export interface StoriesWidgetPayload {
  readonly people: readonly StoryWidgetPerson[];
  readonly generatedAt: string;
}

export interface WidgetPayloads {
  readonly orders: OrderWidgetPayload;
  readonly sellerToday: SellerTodayWidgetPayload;
  readonly liveNow: LiveNowWidgetPayload;
  readonly creatorToday: CreatorTodayWidgetPayload;
  readonly stories: StoriesWidgetPayload;
}

export type WidgetSnapshot<K extends WidgetKind = WidgetKind> =
  | { readonly state: "signedOut" }
  | { readonly state: "unavailable"; readonly savedAt: string }
  | { readonly state: "ready"; readonly savedAt: string; readonly payload: WidgetPayloads[K] };

export interface WidgetSessionDescriptor {
  readonly signedIn: boolean;
  readonly apiBaseUrl: string;
  readonly hideAmounts: boolean;
  readonly theme: "system";
}
