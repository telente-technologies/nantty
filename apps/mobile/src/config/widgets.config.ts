export const widgetAppGroup = "group.com.nantty.app";

export const widgetKinds = ["orders", "sellerToday", "liveNow", "creatorToday", "stories"] as const;
export type WidgetKind = (typeof widgetKinds)[number];

export const widgetEndpoints: Readonly<Record<WidgetKind, string>> = {
  orders: "/api/v1/widgets/orders",
  sellerToday: "/api/v1/widgets/seller-today",
  liveNow: "/api/v1/widgets/live-now",
  creatorToday: "/api/v1/widgets/creator-today",
  stories: "/api/v1/widgets/stories",
};

export const moneyWidgetKinds: readonly WidgetKind[] = ["sellerToday", "creatorToday"];

export const iosWidgetTimelineKinds: Readonly<Record<WidgetKind, string>> = {
  orders: "NanttyOrdersWidget",
  sellerToday: "NanttySellerTodayWidget",
  liveNow: "NanttyLiveNowWidget",
  creatorToday: "NanttyCreatorTodayWidget",
  stories: "NanttyStoriesWidget",
};

export const androidWidgetNames: Readonly<Record<WidgetKind, string>> = {
  orders: "NanttyOrders",
  sellerToday: "NanttySellerToday",
  liveNow: "NanttyLiveNow",
  creatorToday: "NanttyCreatorToday",
  stories: "NanttyStories",
};

export const widgetStorageKeys = {
  token: "zm.widgetToken",
  tokenExpiresAt: "zm.widgetTokenExpiresAt",
  session: "zm.widget.session",
  snapshotPrefix: "zm.widget.snapshot.",
  pushToken: "zm.widget.pushToken",
} as const;

export const widgetTokenRotateBeforeExpiryMs = 6 * 60 * 60 * 1000;
