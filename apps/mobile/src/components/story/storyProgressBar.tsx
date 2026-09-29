import { StyleSheet, View } from "react-native";

import { colors } from "@/constants/colors.constant";

export function StoryProgressBar({ count, activeIndex, progress }: { count: number; activeIndex: number; progress: number }) {
  return (
    <View style={styles.row} accessibilityRole="progressbar" accessibilityLabel={`Story ${activeIndex + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => {
        const fill = i < activeIndex ? 1 : i === activeIndex ? progress : 0;
        return (
          <View key={i} style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(fill * 100)}%` }]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 2, paddingHorizontal: 12, flexDirection: "row", gap: 4 },
  track: { flex: 1, height: 2, borderRadius: 4, backgroundColor: colors.placeholder, overflow: "hidden" },
  fill: { height: 2, borderRadius: 4, backgroundColor: colors.black },
});
