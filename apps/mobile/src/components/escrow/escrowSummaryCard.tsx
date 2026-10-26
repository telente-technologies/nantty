import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { EscrowDetail } from "@/types/commerce.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import { describeEscrowRelease, ESCROW_STAGE_APPEARANCE } from "./escrowStage.util";
import { StatusPill } from "./statusPill";

export function EscrowSummaryCard({ escrow, viewerRole }: { escrow: EscrowDetail; viewerRole: "buyer" | "seller" }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const appearance = ESCROW_STAGE_APPEARANCE[escrow.stage];
  const releaseLine = describeEscrowRelease(escrow);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>
          Order {escrow.orderReference} · {viewerRole === "buyer" ? escrow.store.name : escrow.buyer.name}
        </Text>
        <StatusPill label={appearance.label} tone={appearance.tone} />
      </View>
      <Text size={12} lineHeight={14.4} color={colors.textSubtle}>
        {viewerRole === "buyer" ? "Held in escrow" : "Your payout"}
      </Text>
      <Text size={24} weight={600} lineHeight={28.8} accessibilityLabel={`Amount ${formatMoneyForDisplay(viewerRole === "buyer" ? escrow.heldAmount : escrow.sellerPayoutAmount)}`}>
        {formatMoneyForDisplay(viewerRole === "buyer" ? escrow.heldAmount : escrow.sellerPayoutAmount)}
      </Text>
      {viewerRole === "seller" ? (
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>
          Buyer paid {formatMoneyForDisplay(escrow.heldAmount)} · Nantty fee {formatMoneyForDisplay(escrow.platformFee)}
        </Text>
      ) : null}
      <Text size={13} weight={500} lineHeight={16.9} color={escrow.stage === "disputed" ? colors.error : colors.primary}>
        {releaseLine}
      </Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 6 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 },
}));
