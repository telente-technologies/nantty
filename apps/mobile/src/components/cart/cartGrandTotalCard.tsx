import { StyleSheet, View } from "react-native";

import { MoneyAmount } from "@/components/product/moneyAmount";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Cart, Money } from "@/types";

function GrandTotalLine({ label, amount, strong = false, negative = false }: { label: string; amount: Money; strong?: boolean; negative?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.line}>
      <Text size={13} weight={strong ? 600 : 400} lineHeight={16.9}>{label}</Text>
      <View style={styles.amount}>
        {negative ? <Text size={13} weight={500} lineHeight={16.9}>−</Text> : null}
        <MoneyAmount money={amount} symbolSize={11} symbolWeight={500} amountSize={strong ? 15 : 13} amountWeight={strong ? 600 : 500} showDecimals={false} />
      </View>
    </View>
  );
}

export function CartGrandTotalCard({ cart, shippingQuoteReady = true }: { cart: Cart; shippingQuoteReady?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const excludedCount = shippingQuoteReady && cart.addressId ? cart.groups.length - cart.payableGroupCount : 0;
  return (
    <View style={styles.section}>
      <Text size={14} weight={600} lineHeight={16.8} accessibilityRole="header">Order total</Text>
      <View style={styles.card}>
        <GrandTotalLine label="Items" amount={cart.itemsTotal} />
        {shippingQuoteReady ? (
          <GrandTotalLine label="Shipping" amount={cart.shipping} />
        ) : (
          <View style={styles.line}>
            <Text size={13} lineHeight={16.9}>Shipping</Text>
            <Text size={13} lineHeight={16.9} color={colors.textMuted}>Quote pending</Text>
          </View>
        )}
        {cart.storeCredit.amountMinor > 0 ? <GrandTotalLine label="Store credit" amount={cart.storeCredit} negative /> : null}
        {shippingQuoteReady ? (
          <GrandTotalLine label="Total" amount={cart.total} strong />
        ) : (
          <View style={styles.line} accessibilityRole="text" accessibilityLabel="Total pending delivery quote">
            <Text size={13} weight={600} lineHeight={16.9}>Total</Text>
            <Text size={13} weight={600} lineHeight={16.9} color={colors.textMuted}>—</Text>
          </View>
        )}
        {excludedCount > 0 ? (
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>
            {excludedCount} {excludedCount === 1 ? "seller is" : "sellers are"} not included because they do not ship to your location.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  section: { gap: 12 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, gap: 8 },
  amount: { flexDirection: "row", alignItems: "baseline" },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
}));
