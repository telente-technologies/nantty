import { Pressable, StyleSheet, View } from "react-native";

import { ESCROW_STAGE_APPEARANCE, formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { StatusPill } from "@/components/escrow/statusPill";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { EscrowHold } from "@/types/commerce.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export function EscrowHoldRow({ hold, onPress }: { hold: EscrowHold; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const appearance = ESCROW_STAGE_APPEARANCE[hold.stage];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${hold.productName}, ${formatMoneyForDisplay(hold.amount)}, ${appearance.label}`} onPress={onPress} style={styles.row}>
      <View style={styles.texts}>
        <Text size={14} lineHeight={16.8} numberOfLines={1}>{hold.productName}</Text>
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
          {hold.orderReference} · {hold.expectedReleaseAt ? `releases ~${formatFriendlyDate(hold.expectedReleaseAt)}` : "release paused"}
        </Text>
      </View>
      <View style={styles.trailing}>
        <Text size={14} weight={600} lineHeight={16.8}>{formatMoneyForDisplay(hold.amount)}</Text>
        <StatusPill label={appearance.label} tone={appearance.tone} />
      </View>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  texts: { flex: 1, gap: 2 },
  trailing: { alignItems: "flex-end", gap: 4 },
}));
