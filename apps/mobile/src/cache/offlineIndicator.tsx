import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { useOfflineStore } from "@/store/offline.store";

export function OfflineIndicator() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const isOnline = useOfflineStore((state) => state.isOnline);
  const queuedMutationCount = useOfflineStore((state) => state.queuedMutations.length);
  if (isOnline) return null;
  return (
    <View pointerEvents="none" style={[styles.banner, { top: insets.top }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text size={11} weight={500} lineHeight={14} color={colors.white} align="center">
        {queuedMutationCount > 0
          ? `You're offline — showing saved content. ${queuedMutationCount} pending ${queuedMutationCount === 1 ? "action" : "actions"} will sync`
          : "You're offline — showing saved content"}
      </Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  banner: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingVertical: 3,
    paddingHorizontal: 16,
    backgroundColor: colors.avatar,
    opacity: 0.92,
  },
}));
