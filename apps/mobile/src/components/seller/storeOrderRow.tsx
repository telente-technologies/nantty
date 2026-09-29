import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { Order } from "@/types";

import { OrderStatusPill } from "./orderStatusPill";
import { splitMoneyIntoSymbolAndAmount } from "./splitMoney.util";


export function StoreOrderRow({ order, onPress }: { order: Order; onPress: () => void }) {
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
          <Text size={14} weight={500} lineHeight={16.8} numberOfLines={1}>
            {firstItem?.product.name ?? `Order #${order.reference}`}
          </Text>
          <Text size={13} weight={500} lineHeight={16.9} color={colors.textMuted} numberOfLines={1}>
            Buyer: {order.buyer.name}
          </Text>
        </View>
      </View>
      <View style={styles.trailing}>
        <OrderStatusPill status={order.status} />
        <Text size={16} weight={600} lineHeight={19.2}>
          <Text size={12} weight={600} lineHeight={19.2}>{total.symbol}</Text>
          {total.amount}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 24 },
  product: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  thumbnail: { width: 52, height: 52, borderRadius: 8, backgroundColor: colors.placeholder, overflow: "hidden" },
  text: { flex: 1, gap: 8 },
  trailing: { alignItems: "flex-end", gap: 5 },
});
