export interface WidgetMoneyContract {
  readonly amountMinor: number;
  readonly currency: string;
}

export interface IssueWidgetTokenResponseContract {
  readonly widgetToken: string;
  readonly expiresIn: number;
  readonly scope: "widgets:read";
}

export interface OrderWidgetItemContract {
  readonly id: string;
  readonly reference: string;
  readonly status: "confirmed" | "preparing" | "ready_to_ship" | "in_transit" | "out_for_delivery" | "delivery_failed" | "delivered" | "other";
  readonly statusLabel: string;
  readonly etaAt: string | null;
  readonly itemTitle: string;
  readonly itemCount: number;
  readonly imageUrl: string | null;
  readonly storeName: string;
  readonly deepLink: string;
  readonly updatedAt: string;
}

export interface OrderWidgetResponseContract {
  readonly orders: readonly OrderWidgetItemContract[];
  readonly activeCount: number;
  readonly generatedAt: string;
}

export interface SellerTodayWidgetResponseContract {
  readonly storeName: string;
  readonly salesToday: WidgetMoneyContract | null;
  readonly ordersToday: number;
  readonly ordersToShip: number;
  readonly availableBalance: WidgetMoneyContract | null;
  readonly amountsHidden: boolean;
  readonly deepLink: string;
  readonly generatedAt: string;
}

export interface LiveNowWidgetItemContract {
  readonly id: string;
  readonly hostId: string;
  readonly hostName: string;
  readonly hostUsername: string;
  readonly hostAvatarUrl: string | null;
  readonly title: string;
  readonly viewers: number;
  readonly startedAt: string | null;
  readonly deepLink: string;
}

export interface LiveNowWidgetResponseContract {
  readonly lives: readonly LiveNowWidgetItemContract[];
  readonly generatedAt: string;
}

export interface CreatorTodayWidgetResponseContract {
  readonly creatorProgramMember: boolean;
  readonly viewsToday: number;
  readonly newFollowersToday: number;
  readonly earningsToday: WidgetMoneyContract | null;
  readonly amountsHidden: boolean;
  readonly deepLink: string;
  readonly generatedAt: string;
}

export interface StoryWidgetPersonContract {
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

export interface StoriesWidgetResponseContract {
  readonly people: readonly StoryWidgetPersonContract[];
  readonly generatedAt: string;
}

export interface WidgetRefreshPushDataContract {
  readonly type: "widgetRefresh";
  readonly widgets: readonly ("orders" | "sellerToday" | "liveNow" | "creatorToday" | "stories")[];
}

export interface OembedResponseContract {
  readonly version: "1.0";
  readonly type: "rich";
  readonly provider_name: "Zudomart";
  readonly provider_url: string;
  readonly title: string;
  readonly author_name: string;
  readonly author_url: string;
  readonly html: string;
  readonly width: number;
  readonly height: number;
  readonly cache_age: number;
}
