import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Order } from "@/types";

import { OrderStatusPill } from "./orderStatusPill";
import { splitMoneyIntoSymbolAndAmount } from "./splitMoney.util";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";


export function StoreOrderRow({ order, onPress }: { order: Order; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const firstItem = order.items[0];
  const total = splitMoneyIntoSymbolAndAmount(order.total);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${firstItem?.product.name ?? "Order"}, buyer ${order.buyer.name}, ${order.status}`}
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.product}>
        <View style={styles.thumbnail}>
          {firstItem?.product.imageUrl ? <Image source={{ uri: firstItem.product.imageUrl }} style={StyleSheet.absoluteFill} /> : null}
        </View>
        <View style={styles.text}>
          <Text size={typeScale.md} weight={500} lineHeight={16.8} numberOfLines={1}>
            {firstItem?.product.name ?? `Order #${order.reference}`}
          </Text>
          <Text size={typeScale.sm} weight={500} lineHeight={16.9} color={colors.textMuted} numberOfLines={1}>
            Buyer: {order.buyer.name}
          </Text>
        </View>
      </View>
      <View style={styles.trailing}>
        <OrderStatusPill status={order.status} />
        <Text size={typeScale.base} weight={600} lineHeight={19.2}>
          <Text size={typeScale.xs} weight={600} lineHeight={19.2}>{total.symbol}</Text>
          {total.amount}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[6] },
  product: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing[3] },
  thumbnail: { width: 52, height: 52, borderRadius: 8, backgroundColor: colors.placeholder, overflow: "hidden" },
  text: { flex: 1, gap: spacing[2] },
  trailing: { alignItems: "flex-end", gap: spacing[1] },
}));
