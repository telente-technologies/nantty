import { StyleSheet } from "react-native";

export const RAIL_ITEM_WIDTH = 44;

export const clipRailStyles = StyleSheet.create({
  item: { width: RAIL_ITEM_WIDTH, gap: 4, alignItems: "center" },
  count: { minWidth: RAIL_ITEM_WIDTH, textAlign: "center", fontVariant: ["tabular-nums"], flexShrink: 0 },
  readableOnVideo: { textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
});
