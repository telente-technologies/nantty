import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { useLiveViewerPoints } from "./liveZudoPoints.hook";

export function LiveViewerPointsPill({ liveId }: { liveId: string }) {
  const points = useLiveViewerPoints(liveId, true);
  if (!points.data) return null;
  const total = points.data.totalPoints.toLocaleString("en-US");
  return (
    <View accessible accessibilityLabel={`Your ZudoPoints on this live: ${total}`} accessibilityLiveRegion="polite" style={styles.pill}>
      <Text size={11} weight={600} lineHeight={14} color={colors.white}>
        Your points {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.4)", alignSelf: "flex-start" },
});
