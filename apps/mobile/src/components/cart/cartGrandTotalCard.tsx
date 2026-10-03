import { StyleSheet, View } from "react-native";

import { MoneyAmount } from "@/components/product/moneyAmount";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Cart, Money } from "@/types";

function GrandTotalLine({ label, amount, strong = false }: { label: string; amount: Money; strong?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.line}>
      <Text size={13} weight={strong ? 600 : 400} lineHeight={16.9}>{label}</Text>
      <MoneyAmount money={amount} symbolSize={11} symbolWeight={500} amountSize={strong ? 15 : 13} amountWeight={strong ? 600 : 500} showDecimals={false} />
    </View>
  );
}

export function CartGrandTotalCard({ cart }: { cart: Cart }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const excludedCount = cart.addressId ? cart.groups.length - cart.payableGroupCount : 0;
  return (
    <View style={styles.section}>
      <Text size={14} weight={600} lineHeight={16.8} accessibilityRole="header">Order total</Text>
      <View style={styles.card}>
        <GrandTotalLine label="Items" amount={cart.itemsTotal} />
        <GrandTotalLine label="Shipping" amount={cart.shipping} />
        <GrandTotalLine label="Total" amount={cart.total} strong />
        {excludedCount > 0 ? (
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>
            {excludedCount} {excludedCount === 1 ? "seller is" : "sellers are"} not included because they don't ship to your location.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  section: { gap: 12 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, gap: 8 },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
}));
