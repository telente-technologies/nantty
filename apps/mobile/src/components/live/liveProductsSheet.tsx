import { Pressable, StyleSheet, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { ProductSummary } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export interface LiveProductsSheetProps {
  readonly visible: boolean;
  readonly products: readonly ProductSummary[];
  readonly onClose: () => void;
  readonly onOpenProduct: (productId: string) => void;
}

export function LiveProductsSheet({ visible, products, onClose, onOpenProduct }: LiveProductsSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="In this live" floating>
      <View style={styles.list}>
        {products.map((product) => (
          <Pressable key={product.id} accessibilityRole="button" onPress={() => onOpenProduct(product.id)} style={styles.item}>
            <View style={styles.row}>
              <View style={styles.thumb} />
              <Text size={14} lineHeight={16.8} numberOfLines={1} style={styles.name}>
                {product.name}
              </Text>
              <Text size={14} weight={600} lineHeight={16.8}>
                {formatMoneyForDisplay(product.price, { showDecimals: false })}
              </Text>
            </View>
            <View style={styles.divider} />
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  item: { paddingHorizontal: 4, gap: 9 },
  row: { height: 40, flexDirection: "row", alignItems: "center", gap: 8 },
  thumb: { width: 40, height: 40, borderRadius: 4, backgroundColor: colors.avatar },
  name: { flex: 1 },
  divider: { height: 1, backgroundColor: colors.divider },
});
