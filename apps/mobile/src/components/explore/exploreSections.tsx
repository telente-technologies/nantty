import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export function ExploreSectionHeader({ title, actionLabel, onPressAction }: { readonly title: string; readonly actionLabel?: string; readonly onPressAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Text size={17} weight={700} accessibilityRole="header">{title}</Text>
      {actionLabel && onPressAction ? (
        <Pressable accessibilityRole="button" onPress={onPressAction} hitSlop={8}>
          <Text size={13} weight={500} color={colors.primary}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ExploreSectionState({ loading, error, empty, emptyMessage, onRetry, skeletonRows = 3, children }: {
  readonly loading: boolean;
  readonly error: boolean;
  readonly empty: boolean;
  readonly emptyMessage: string;
  readonly onRetry: () => void;
  readonly skeletonRows?: number;
  readonly children: ReactNode;
}) {
  const { colors } = useTheme();
  if (loading) {
    return (
      <View style={styles.skeletons} accessibilityLabel="Loading">
        {Array.from({ length: skeletonRows }, (_, index) => (
          <View key={index} style={styles.skeletonRow}>
            <Skeleton width="40%" height={10} />
            <Skeleton width="80%" height={14} />
            <Skeleton width="25%" height={10} />
          </View>
        ))}
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.message} accessibilityRole="alert">
        <Text size={13} color={colors.textMuted}>This didn't load.</Text>
        <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={8}>
          <Text size={13} weight={600} color={colors.primary}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.message}>
        <Text size={13} color={colors.textSubtle}>{emptyMessage}</Text>
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  skeletons: { paddingHorizontal: 16, gap: 16, paddingVertical: 8 },
  skeletonRow: { gap: 6 },
  message: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", gap: 8, alignItems: "center" },
});
