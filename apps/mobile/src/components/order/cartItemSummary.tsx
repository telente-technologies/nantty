import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { CartItem } from "@/types";
import { formatMoneyForDisplay, multiplyMoneyByQuantity } from "@/utils/formatMoney.util";

export function CartItemSummary({ item, onPress }: { item: CartItem; onPress?: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={item.product.name} onPress={onPress} style={styles.row}>
      <View style={styles.image}>
        {item.product.imageUrl ? <Image source={{ uri: item.product.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </View>
      <View style={styles.text}>
        <Text size={14} weight={500} lineHeight={16.8} numberOfLines={1}>{item.product.name}</Text>
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
          Qty {item.quantity}
          {item.variant ? ` · ${item.variant}` : ""}
        </Text>
      </View>
      <Text size={14} weight={500} lineHeight={16.8}>{formatMoneyForDisplay(multiplyMoneyByQuantity(item.product.price, item.quantity))}</Text>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  image: { width: 48, height: 48, borderRadius: 8, backgroundColor: colors.placeholder, overflow: "hidden" },
  text: { flex: 1, gap: 4 },
}));
