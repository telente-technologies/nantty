import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { PayoutSyncStatus } from "@/types/payoutOnboarding.type";

const LABELS: Record<PayoutSyncStatus, string> = { saved: "Saved", sending: "Sending", done: "Done", needs_attention: "Needs attention" };

export function SyncBadge({ status }: { readonly status: PayoutSyncStatus }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const tone = status === "done" ? [colors.successTint, colors.successText] : status === "needs_attention" ? [colors.errorTint, colors.error] : status === "sending" ? [colors.cautionTint, colors.cautionText] : [colors.surface, colors.textMuted];
  return (
    <View style={[styles.badge, { backgroundColor: tone[0] }]} accessibilityLabel={`Sync status: ${LABELS[status]}`}>
      <Text size={11} weight={500} lineHeight={13.2} color={tone[1]}>{LABELS[status]}</Text>
    </View>
  );
}

const useStyles = makeThemedStyles(() => StyleSheet.create({ badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 } }));
