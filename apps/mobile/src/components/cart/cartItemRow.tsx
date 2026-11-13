import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Minus16Icon, Plus16AltIcon, Trash24Icon } from "@/components/icons";
import { MoneyAmount } from "@/components/product/moneyAmount";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { CartItem } from "@/types";

export interface CartItemRowProps {
  readonly item: CartItem;
  readonly onChangeQuantity: (quantity: number) => void;
  readonly onRemove: () => void;
  readonly onPress: () => void;
}

export function CartItemRow({ item, onChangeQuantity, onRemove, onPress }: CartItemRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={item.product.name} onPress={onPress} style={styles.left}>
        <View style={styles.image}>
          {item.product.imageUrl ? <Image source={{ uri: item.product.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        </View>
        <View style={styles.details}>
          <Text size={14} weight={500} lineHeight={16.8} numberOfLines={1}>
            {item.product.name}
          </Text>
          {item.available === false ? <Text size={12} lineHeight={16} color={colors.error} accessibilityRole="text">Out of stock — remove this item to continue.</Text> : null}
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
              disabled={item.quantity <= 1}
              hitSlop={8}
              onPress={() => onChangeQuantity(item.quantity - 1)}
              style={item.quantity <= 1 ? styles.disabled : undefined}
            >
              <Minus16Icon />
            </Pressable>
            <Text size={14} weight={500} lineHeight={16.8} color={colors.primary} accessibilityLabel={`Quantity ${item.quantity}`}>
              {item.quantity}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Increase quantity" disabled={item.available === false} hitSlop={8} onPress={() => onChangeQuantity(item.quantity + 1)} style={item.available === false ? styles.disabled : undefined}>
              <Plus16AltIcon />
            </Pressable>
          </View>
        </View>
      </Pressable>
      <View style={styles.right}>
        <MoneyAmount money={item.product.price} symbolSize={12} amountSize={16} />
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.product.name}`} hitSlop={8} onPress={onRemove}>
          <Trash24Icon />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 24 },
  left: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  image: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.placeholder, overflow: "hidden" },
  details: { flex: 1, gap: 12 },
  stepper: {
    alignSelf: "flex-start",
    height: 35,
    paddingHorizontal: 8,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  disabled: { opacity: 0.4 },
  right: { alignItems: "flex-end", gap: 12 },
}));
