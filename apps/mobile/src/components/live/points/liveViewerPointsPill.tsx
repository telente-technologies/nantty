import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useLiveViewerPoints } from "./liveNanttyPoints.hook";
import { liveGlass } from "../liveSurface.constant";

export function LiveViewerPointsPill({ liveId }: { liveId: string }) {
  const points = useLiveViewerPoints(liveId, true);
  if (!points.data) return null;
  const total = points.data.totalPoints.toLocaleString("en-US");
  return (
    <View accessible accessibilityLabel={`Your Nantty Points on this live: ${total}`} accessibilityLiveRegion="polite" style={styles.pill}>
      <Text size={11} weight={600} lineHeight={14} color={liveGlass.ink}>
        Your points {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: liveGlass.background, borderWidth: StyleSheet.hairlineWidth, borderColor: liveGlass.border, alignSelf: "flex-start" },
});
