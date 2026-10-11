import { StyleSheet, View } from "react-native";

import { Shield24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { palette } from "@/constants/colors.constant";
import { makeThemedStyles, useTheme } from "@/theme";

const BUYER_POINTS = [
  "Your payment is locked in your own wallet, held by our licensed payment partner. It doesn't go straight to the seller.",
  "The seller only gets paid after you confirm the order arrived as described, or 3 days after delivery if you don't report a problem.",
  "Something wrong? Open a dispute and we pause the payment until it's sorted.",
];

const SELLER_POINTS = [
  "The buyer's payment is already secured — you won't be scammed with fake alerts.",
  "Ship quickly and add tracking so the buyer can confirm sooner.",
  "Funds move to your wallet when the buyer confirms, or automatically 3 days after delivery.",
];

export function EscrowExplainerCard({ viewerRole }: { viewerRole: "buyer" | "seller" }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const points = viewerRole === "buyer" ? BUYER_POINTS : SELLER_POINTS;
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Shield24Icon size={20} color={colors.primary} />
        <Text size={14} weight={600} lineHeight={16.8} color={palette.primary[800]}>
          How escrow protects {viewerRole === "buyer" ? "you" : "your sale"}
        </Text>
      </View>
      {points.map((point) => (
        <View key={point} style={styles.point}>
          <View style={styles.bullet} />
          <Text size={13} lineHeight={17.5} color={colors.textMuted} style={styles.pointText}>
            {point}
          </Text>
        </View>
      ))}
      <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
        Escrow and buyer protection apply in Nigeria only. Outside Nigeria you pay sellers directly at your own risk.
      </Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.primaryTint, borderRadius: 12, padding: 12, gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  point: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primarySolid, marginTop: 7 },
  pointText: { flex: 1 },
}));
