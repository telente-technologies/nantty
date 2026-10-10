import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Storefront24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import type { ProductSummary } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { makeThemedStyles, useTheme } from "@/theme";

export interface LiveProductsSheetProps {
  readonly visible: boolean;
  readonly products: readonly ProductSummary[];
  readonly onClose: () => void;
  readonly onOpenProduct: (productId: string) => void;
}

export function LiveProductsSheet({ visible, products, onClose, onOpenProduct }: LiveProductsSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="In this live" floating>
      <View style={styles.list}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          <Storefront24Icon size={22} color={colors.textMuted} />
        </View>
        {products.map((product) => (
          <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={product.name} onPress={() => onOpenProduct(product.id)} style={styles.item}>
            <View style={styles.row}>
              <View style={styles.thumb}>
                {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </View>
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

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  item: { paddingHorizontal: 4, gap: 9 },
  row: { height: 40, flexDirection: "row", alignItems: "center", gap: 8 },
  thumb: { width: 40, height: 40, borderRadius: 4, overflow: "hidden", backgroundColor: colors.placeholder },
  name: { flex: 1 },
  divider: { height: 1, backgroundColor: colors.divider },
}));
