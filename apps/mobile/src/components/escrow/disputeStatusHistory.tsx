import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { DisputeStatusEvent } from "@/types/commerce.type";

import { DISPUTE_STATUS_APPEARANCE, formatFriendlyDateTime } from "./escrowStage.util";
import { toneTextColor } from "./statusPill";

export function DisputeStatusHistory({ events }: { events: readonly DisputeStatusEvent[] }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View accessibilityRole="list">
      {events.map((event, index) => {
        const isLatest = index === events.length - 1;
        const dotColor = toneTextColor(DISPUTE_STATUS_APPEARANCE[event.status].tone);
        return (
          <View key={`${event.status}-${event.occurredAt}`} style={styles.step}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: isLatest ? dotColor : colors.divider }]} />
              {isLatest ? null : <View style={styles.line} />}
            </View>
            <View style={styles.texts}>
              <Text size={14} weight={isLatest ? 500 : 400} lineHeight={16.8} color={isLatest ? colors.text : colors.textMuted}>
                {event.label}
              </Text>
              <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
                {formatFriendlyDateTime(event.occurredAt)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  step: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center", width: 12, paddingTop: 3 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { width: 2, flex: 1, minHeight: 18, backgroundColor: colors.divider, marginVertical: 2 },
  texts: { flex: 1, paddingBottom: 14, gap: 2 },
}));
