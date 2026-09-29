import { StyleSheet, View } from "react-native";

import { MoneyAmount } from "@/components/product/moneyAmount";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { Money } from "@/types";

export interface OrderSummaryCardProps {
  readonly itemsTotal: Money;
  readonly shopDiscount: Money;
  readonly shipping: Money;
  readonly total: Money;
  readonly title?: string;
}

function SummaryAmount({ amount }: { amount: Money }) {
  return <MoneyAmount money={amount} symbolSize={11} symbolWeight={500} amountSize={13} amountWeight={500} showDecimals={false} />;
}

export function OrderSummaryCard({ itemsTotal, shopDiscount, shipping, total, title = "Order Summary" }: OrderSummaryCardProps) {
  return (
    <View style={styles.section}>
      <Text size={14} weight={600} lineHeight={16.8} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.card}>
        <View style={styles.lines}>
          <View style={styles.line}>
            <Text size={13} lineHeight={16.9}>Item(s) total</Text>
            <SummaryAmount amount={itemsTotal} />
          </View>
          <View style={styles.line}>
            <Text size={13} lineHeight={16.9}>Shop discount</Text>
            <SummaryAmount amount={shopDiscount} />
          </View>
          <View style={styles.line}>
            <Text size={13} lineHeight={16.9}>Shipping</Text>
            {shipping.amountMinor === 0 ? (
              <Text size={12} lineHeight={16.8}>Free</Text>
            ) : (
              <SummaryAmount amount={shipping} />
            )}
          </View>
        </View>
        <View style={styles.line}>
          <Text size={13} weight={500} lineHeight={16.9}>Estimated total</Text>
          <SummaryAmount amount={total} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, gap: 24 },
  lines: { gap: 8 },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
