import { Pressable, StyleSheet, View } from "react-native";

import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ThreadSort } from "@/types/postThread.type";

import { THREAD_AVATAR_SIZE } from "./threadReplyRow";

const SORT_OPTIONS: readonly { readonly value: ThreadSort; readonly label: string }[] = [
  { value: "top", label: "Top" },
  { value: "latest", label: "Latest" },
];

export function ThreadSortTabs({ sort, onChange }: { readonly sort: ThreadSort; readonly onChange: (sort: ThreadSort) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {SORT_OPTIONS.map((option) => {
        const isSelected = option.value === sort;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`Sort replies by ${option.label}`}
            onPress={() => onChange(option.value)}
            style={styles.tab}
          >
            <Text size={15} weight={isSelected ? 600 : 500} lineHeight={20} color={isSelected ? colors.text : colors.textMuted}>
              {option.label}
            </Text>
            <View style={[styles.indicator, isSelected ? { backgroundColor: colors.primary } : null]} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function ThreadSkeleton({ rows = 4 }: { readonly rows?: number }) {
  const styles = useStyles();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading replies">
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.skeletonRow}>
          <Skeleton width={THREAD_AVATAR_SIZE} height={THREAD_AVATAR_SIZE} radius={THREAD_AVATAR_SIZE / 2} />
          <View style={styles.skeletonBody}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="92%" height={13} />
            <Skeleton width={index % 2 === 0 ? "70%" : "40%"} height={13} />
            <View style={styles.skeletonActions}>
              <Skeleton width={36} height={12} />
              <Skeleton width={36} height={12} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function ThreadEmptyState({ isGuest }: { readonly isGuest: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.state}>
      <Text size={17} weight={600} lineHeight={22} align="center">
        No replies yet
      </Text>
      <Text size={14} lineHeight={19} color={colors.textMuted} align="center">
        {isGuest ? "Sign in to start the conversation." : "Be the first to reply to this post."}
      </Text>
    </View>
  );
}

export function ThreadErrorState({ onRetry }: { readonly onRetry: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.state} accessibilityRole="alert">
      <Text size={15} weight={500} lineHeight={20} align="center">
        {"Replies didn’t load"}
      </Text>
      <Text size={14} lineHeight={19} color={colors.textMuted} align="center">
        Check your connection, then try again.
      </Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
        <Text size={14} weight={600} lineHeight={18} color={colors.onPrimary}>
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider, backgroundColor: colors.surface },
    tab: { flex: 1, alignItems: "center", paddingTop: 12, gap: 10, minHeight: 44 },
    indicator: { height: 3, width: 48, borderRadius: 2 },
    skeletonRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
    skeletonBody: { flex: 1, gap: 8 },
    skeletonActions: { flexDirection: "row", gap: 24, marginTop: 4 },
    state: { paddingHorizontal: 32, paddingVertical: 40, gap: 8, alignItems: "center" },
    retry: { marginTop: 8, minHeight: 40, paddingHorizontal: 20, borderRadius: 20, backgroundColor: colors.primarySolid, alignItems: "center", justifyContent: "center" },
  }),
);
