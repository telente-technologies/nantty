import { StyleSheet, View } from "react-native";

import { orderProgressSteps, resolveOrderProgress } from "@nantty/contracts";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { OrderTimelineEvent } from "@/types";

export function OrderProgress({ status, timeline }: { readonly status: string; readonly timeline?: readonly OrderTimelineEvent[] }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const progress = resolveOrderProgress(status, timeline);
  if (progress.currentIndex === null && !progress.terminalMessage) return null;
  const currentIndex = progress.currentIndex;

  return (
    <View style={styles.card} accessibilityLabel="Order progress">
      <Text size={14} weight={600} lineHeight={16.8} accessibilityRole="header">Progress</Text>
      {currentIndex !== null ? orderProgressSteps.map((label, index) => {
        const state = progress.terminalMessage
          ? index <= currentIndex ? "done" : "blocked"
          : index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
        return (
          <View key={label} style={styles.step} accessibilityLabel={`${label}: ${state}`}>
            <View style={[styles.marker, state === "done" ? styles.done : null, state === "current" ? styles.current : null]} />
            <Text size={12} lineHeight={16.8} style={state === "blocked" || state === "todo" ? styles.pendingLabel : undefined}>{label}</Text>
          </View>
        );
      }) : null}
      {progress.terminalMessage ? <Text size={12} lineHeight={16.8} color={colors.textMuted} accessibilityRole="summary">{progress.terminalMessage}</Text> : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 12 },
  step: { minHeight: 24, flexDirection: "row", alignItems: "center", gap: 10 },
  marker: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.divider, backgroundColor: colors.surface },
  done: { borderColor: colors.success, backgroundColor: colors.success },
  current: { borderColor: colors.primary, backgroundColor: colors.surface },
  pendingLabel: { color: colors.textSubtle },
  note: { color: colors.textMuted },
}));
