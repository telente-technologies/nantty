import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorGlyph } from "@/components/icons/errorIcons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { useOfflineStore } from "@/store/offline.store";
import { showToast } from "@/store/toast.store";

export function describeOfflineBanner(queuedMutationCount: number): string {
  if (queuedMutationCount === 0) return "You're offline. Showing saved content. Check your data or Wi-Fi.";
  const actions = queuedMutationCount === 1 ? "1 action" : `${queuedMutationCount} actions`;
  return `You're offline. ${actions} will send when you're back online.`;
}

export function useBackOnlineToast(): void {
  const isOnline = useOfflineStore((state) => state.isOnline);
  const wasOfflineRef = useRef(!isOnline);
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }
    if (!wasOfflineRef.current) return;
    wasOfflineRef.current = false;
    const pending = useOfflineStore.getState().queuedMutations.length;
    showToast(pending > 0 ? "You're back online. Sending what you did offline…" : "You're back online", { tone: "success" });
  }, [isOnline]);
}

export function OfflineIndicator() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const isOnline = useOfflineStore((state) => state.isOnline);
  const queuedMutationCount = useOfflineStore((state) => state.queuedMutations.length);
  useBackOnlineToast();
  if (isOnline) return null;
  return (
    <View pointerEvents="none" style={[styles.banner, { top: insets.top }]} accessibilityRole="summary" accessibilityLiveRegion="polite" testID="offline-banner">
      <ErrorGlyph name="wifiSlash" size={13} color={colors.white} weight="bold" />
      <Text size={11} weight={500} lineHeight={14} color={colors.white} align="center">
        {describeOfflineBanner(queuedMutationCount)}
      </Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  banner: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 16,
    backgroundColor: colors.avatar,
    opacity: 0.94,
  },
}));
