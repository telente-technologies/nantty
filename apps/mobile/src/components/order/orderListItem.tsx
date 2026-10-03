import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Order } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import { OrderStatusBadge } from "./orderStatusBadge";

export function OrderListItem({ order, subtitle, onPress }: { order: Order; subtitle: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const firstItem = order.items[0];
  const extraItems = order.items.length - 1;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Order ${order.reference}`} onPress={onPress} style={styles.row}>
      <View style={styles.image}>
        {firstItem?.product.imageUrl ? <Image source={{ uri: firstItem.product.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </View>
      <View style={styles.middle}>
        <Text size={14} weight={500} lineHeight={16.8} numberOfLines={1}>
          {firstItem?.product.name ?? order.reference}
          {extraItems > 0 ? ` +${extraItems}` : ""}
        </Text>
        <Text size={12} weight={500} lineHeight={14.4} color={colors.textSubtle}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.right}>
        <OrderStatusBadge status={order.status} />
        <Text size={14} weight={600} lineHeight={16.8}>
          {formatMoneyForDisplay(order.total)}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  image: { width: 44, height: 44, borderRadius: 6, backgroundColor: colors.placeholder, overflow: "hidden" },
  middle: { flex: 1, gap: 4 },
  right: { alignItems: "flex-end", gap: 4 },
}));
