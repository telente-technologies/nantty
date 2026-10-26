import { Appearance } from "react-native";
import type { WidgetInfo } from "react-native-android-widget";

import type { WidgetKind } from "@/config/widgets.config";
import type { WidgetPayloads, WidgetSnapshot } from "@/types/widget.type";

import { widgetPaletteFor, widgetSizeFromDimensions } from "../widgetPresentation.util";
import { loadWidgetSnapshot } from "../widgetSnapshotReader.util";
import { AndroidWidgetMessage } from "./androidWidgetParts";
import { OrdersAndroidWidget, SellerTodayAndroidWidget } from "./commerceAndroidWidgets";
import { CreatorTodayAndroidWidget, LiveNowAndroidWidget, StoriesAndroidWidget } from "./socialAndroidWidgets";

const widgetTitles: Readonly<Record<WidgetKind, string>> = { orders: "Orders", sellerToday: "Sales today", liveNow: "Live now", creatorToday: "Creator stats", stories: "Stories" };

export function buildAndroidWidget(kind: WidgetKind, snapshot: WidgetSnapshot, info: Pick<WidgetInfo, "width" | "height">, scheme: "light" | "dark", now = new Date()) {
  const palette = widgetPaletteFor(scheme);
  const size = widgetSizeFromDimensions(info.width, info.height);
  if (snapshot.state === "signedOut") return <AndroidWidgetMessage palette={palette} deepLink="zudomart://" title={widgetTitles[kind]} message="Sign in to Nantty" />;
  if (snapshot.state === "unavailable") {
    const message = kind === "sellerToday" ? "Open a store to see today's sales." : "Open Nantty to refresh.";
    return <AndroidWidgetMessage palette={palette} deepLink={kind === "sellerToday" ? "zudomart://seller/dashboard" : "zudomart://"} title={widgetTitles[kind]} message={message} />;
  }
  const payload = snapshot.payload;
  switch (kind) {
    case "orders": return <OrdersAndroidWidget payload={payload as WidgetPayloads["orders"]} palette={palette} size={size} now={now} />;
    case "sellerToday": return <SellerTodayAndroidWidget payload={payload as WidgetPayloads["sellerToday"]} palette={palette} size={size} />;
    case "liveNow": return <LiveNowAndroidWidget payload={payload as WidgetPayloads["liveNow"]} palette={palette} size={size} />;
    case "creatorToday": return <CreatorTodayAndroidWidget payload={payload as WidgetPayloads["creatorToday"]} palette={palette} size={size} />;
    case "stories": return <StoriesAndroidWidget payload={payload as WidgetPayloads["stories"]} palette={palette} size={size} />;
  }
}

export async function renderStoredAndroidWidget(kind: WidgetKind, info: Pick<WidgetInfo, "width" | "height">, fetchFresh = false) {
  const snapshot = await loadWidgetSnapshot(kind, fetchFresh);
  return buildAndroidWidget(kind, snapshot, info, Appearance.getColorScheme() === "dark" ? "dark" : "light");
}
