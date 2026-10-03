import { StyleSheet, View } from "react-native";

import { MoneyAmount } from "@/components/product/moneyAmount";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { CartSellerGroup } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const CLOSE_TO_FREE_SHIPPING_RATIO = 0.5;

export function describeShippingHint(group: CartSellerGroup): string | null {
  const { shipping } = group;
  if (shipping.status !== "calculated") return shipping.message;
  const threshold = shipping.freeThreshold;
  if (!threshold) return shipping.isFree ? "You qualify for free shipping to your location" : null;
  const thresholdText = formatMoneyForDisplay(threshold, { showDecimals: false });
  if (shipping.isFree) return `You qualify for free shipping on orders above ${thresholdText}`;
  const remaining = shipping.amountToFreeShipping!;
  const isClose = remaining.amountMinor <= threshold.amountMinor * CLOSE_TO_FREE_SHIPPING_RATIO;
  return isClose
    ? `Add ${formatMoneyForDisplay(remaining, { showDecimals: false })} more for free shipping`
    : `Free shipping on orders above ${thresholdText}`;
}

export function ShippingStatusLine({ group }: { group: CartSellerGroup }) {
  const { colors } = useTheme();
  const { shipping } = group;
  const hint = describeShippingHint(group);
  const isBlocked = shipping.status === "notDeliverable";
  return (
    <View style={styles.block}>
      <View style={styles.line}>
        <Text size={13} lineHeight={16.9}>Shipping</Text>
        {shipping.status !== "calculated" ? (
          <Text size={13} lineHeight={16.9} color={colors.textMuted}>{isBlocked ? "Unavailable" : "--"}</Text>
        ) : shipping.isFree ? (
          <Text size={13} weight={600} lineHeight={16.9} color={colors.primary}>FREE</Text>
        ) : (
          <MoneyAmount money={shipping.fee!} symbolSize={11} symbolWeight={500} amountSize={13} amountWeight={500} showDecimals={false} />
        )}
      </View>
      {hint ? (
        <Text size={12} lineHeight={16.8} color={isBlocked ? colors.error : colors.textMuted} accessibilityRole={isBlocked ? "alert" : undefined}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 4 },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
