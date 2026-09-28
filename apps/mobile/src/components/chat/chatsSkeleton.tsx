import { StyleSheet, View } from "react-native";

import { colors } from "@/constants/colors.constant";

export function ChatsSkeleton() {
  return (
    <View accessibilityLabel="Loading chats" accessibilityRole="progressbar" style={styles.root}>
      <View style={styles.storyRow}>
        {Array.from({ length: 5 }, (_, i) => (
          <View key={i} style={styles.storyItem}>
            <View style={styles.storyBubble}>
              <View style={styles.storyCircle} />
              <View style={styles.storyBadge} />
            </View>
            <View style={styles.storyLabel} />
          </View>
        ))}
      </View>
      <View style={styles.tabs}>
        <View style={[styles.tab, { width: 78 }]} />
        <View style={[styles.tab, { width: 96 }]} />
      </View>
      <View style={styles.list}>
        {Array.from({ length: 7 }, (_, i) => (
          <View key={i} style={styles.row}>
            <View style={styles.rowAvatar} />
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <View style={[styles.bar, { width: 187, height: 12 }]} />
                <View style={[styles.bar, { width: 41, height: 12 }]} />
              </View>
              <View style={[styles.bar, { height: 14 }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  storyRow: { flexDirection: "row", paddingHorizontal: 16, gap: 12, overflow: "hidden" },
  storyItem: { width: 68, alignItems: "center", gap: 8 },
  storyBubble: { width: 68, height: 60 },
  storyCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.placeholder },
  storyBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.placeholder,
    borderWidth: 1.5,
    borderColor: "#C4C4C4",
  },
  storyLabel: { width: 36, height: 8, backgroundColor: colors.placeholder },
  tabs: { flexDirection: "row", gap: 6, paddingHorizontal: 16, marginTop: 21 },
  tab: { height: 20, borderRadius: 4, backgroundColor: colors.placeholder },
  list: { paddingHorizontal: 16, marginTop: 15, gap: 12 },
  row: { height: 64, flexDirection: "row", alignItems: "center", gap: 12 },
  rowAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.placeholder },
  rowBody: { flex: 1, gap: 11 },
  rowTop: { flexDirection: "row", justifyContent: "space-between" },
  bar: { backgroundColor: colors.placeholder },
});
