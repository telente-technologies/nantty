import { StyleSheet, View } from "react-native";

import { CartItemRow } from "@/components/cart/cartItemRow";
import { ShippingStatusLine } from "@/components/cart/shippingStatusLine";
import { MoneyAmount } from "@/components/product/moneyAmount";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { CartSellerGroup, Money } from "@/types";

export interface CartSellerGroupCardProps {
  readonly group: CartSellerGroup;
  readonly showItems?: boolean;
  readonly shippingQuoteReady?: boolean;
  readonly onOpenProduct?: (productId: string) => void;
  readonly onChangeQuantity?: (cartItemId: string, quantity: number) => void;
  readonly onRemove?: (cartItemId: string) => void;
}

function AmountLine({ label, amount, strong = false }: { label: string; amount: Money; strong?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.line}>
      <Text size={13} weight={strong ? 600 : 400} lineHeight={16.9}>{label}</Text>
      <MoneyAmount money={amount} symbolSize={11} symbolWeight={500} amountSize={13} amountWeight={strong ? 600 : 500} showDecimals={false} />
    </View>
  );
}

export function CartSellerGroupCard({ group, showItems = true, shippingQuoteReady = true, onOpenProduct, onChangeQuantity, onRemove }: CartSellerGroupCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isBlocked = group.shipping.status === "notDeliverable";
  return (
    <View style={[styles.card, isBlocked && styles.blocked]} accessibilityLabel={`Seller ${group.storeName}`}>
      <Text size={14} weight={600} lineHeight={16.8} accessibilityRole="header">{group.storeName}</Text>
      {showItems
        ? group.items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              onPress={() => onOpenProduct?.(item.product.id)}
              onChangeQuantity={(quantity) => onChangeQuantity?.(item.id, quantity)}
              onRemove={() => onRemove?.(item.id)}
            />
          ))
        : null}
      <View style={styles.lines}>
        <AmountLine label="Subtotal" amount={group.subtotal} />
        <AmountLine label="Discounts" amount={group.discounts} />
        {shippingQuoteReady ? (
          <>
            <ShippingStatusLine group={group} />
            {isBlocked ? null : <AmountLine label="Seller total" amount={group.total} strong />}
          </>
        ) : (
          <Text size={12} lineHeight={16.8} color={colors.textMuted} accessibilityRole="status">
            Delivery total updates after the address quote is ready.
          </Text>
        )}
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, gap: 4 },
  blocked: { borderColor: colors.error },
  lines: { gap: 8, paddingTop: 8 },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
}));
