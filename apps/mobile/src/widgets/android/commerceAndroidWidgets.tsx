import { FlexWidget, ImageWidget, TextWidget } from "react-native-android-widget";

import type { OrderWidgetPayload, SellerTodayWidgetPayload } from "@/types/widget.type";

import { widgetAmountText, widgetEtaText, type WidgetPalette, type WidgetSize } from "../widgetPresentation.util";
import { AndroidWidgetHeader, AndroidWidgetMessage, AndroidWidgetShell, AndroidWidgetStat } from "./androidWidgetParts";

export function OrdersAndroidWidget({ payload, palette, size, now }: { readonly payload: OrderWidgetPayload; readonly palette: WidgetPalette; readonly size: WidgetSize; readonly now: Date }) {
  const first = payload.orders[0];
  if (first === undefined) return <AndroidWidgetMessage palette={palette} deepLink="nantty://orders" title="Orders" message="No active orders right now." />;
  const shown = size === "small" ? [first] : payload.orders.slice(0, 3);
  return (
    <AndroidWidgetShell palette={palette} deepLink={size === "small" ? first.deepLink : "nantty://orders"}>
      <AndroidWidgetHeader palette={palette} title={payload.activeCount > 1 ? `${payload.activeCount} active orders` : "Your order"} />
      {shown.map((order) => (
        <FlexWidget key={order.id} clickAction="OPEN_URI" clickActionData={{ uri: order.deepLink }} style={{ flexDirection: "row", alignItems: "center", width: "match_parent", marginTop: 6 }}>
          {size !== "small" && order.imageUrl !== null && order.imageUrl.startsWith("https:")
            ? <ImageWidget image={order.imageUrl as `https:${string}`} imageWidth={36} imageHeight={36} radius={8} style={{ marginRight: 8 }} />
            : null}
          <FlexWidget style={{ flexDirection: "column", flex: 1 }}>
            <TextWidget text={order.statusLabel} maxLines={1} style={{ fontSize: 15, fontWeight: "700", color: palette.brand }} />
            <TextWidget text={widgetEtaText(order.etaAt, now) ?? order.storeName} maxLines={1} style={{ fontSize: 12, color: palette.muted }} />
            {size === "small" ? <TextWidget text={order.itemTitle} maxLines={2} style={{ fontSize: 12, color: palette.text }} /> : null}
          </FlexWidget>
        </FlexWidget>
      ))}
    </AndroidWidgetShell>
  );
}

export function SellerTodayAndroidWidget({ payload, palette, size }: { readonly payload: SellerTodayWidgetPayload; readonly palette: WidgetPalette; readonly size: WidgetSize }) {
  return (
    <AndroidWidgetShell palette={palette} deepLink={payload.deepLink}>
      <AndroidWidgetHeader palette={palette} title={payload.storeName === "" ? "Sales today" : payload.storeName} />
      <AndroidWidgetStat palette={palette} label="Sales today" value={widgetAmountText(payload.salesToday, payload.amountsHidden)} />
      <FlexWidget style={{ flexDirection: "row", width: "match_parent" }}>
        <AndroidWidgetStat palette={palette} label="To ship" value={String(payload.ordersToShip)} />
        {size !== "small" ? <AndroidWidgetStat palette={palette} label="Orders today" value={String(payload.ordersToday)} /> : null}
        {size !== "small" ? <AndroidWidgetStat palette={palette} label="Available" value={widgetAmountText(payload.availableBalance, payload.amountsHidden)} /> : null}
      </FlexWidget>
    </AndroidWidgetShell>
  );
}
