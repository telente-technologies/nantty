import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Plus16Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ProductSummary } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export interface PostProductsSheetProps {
  readonly products: readonly ProductSummary[] | null;
  readonly onClose: () => void;
  readonly onPressProduct: (productId: string) => void;
  readonly onAddProduct: (product: ProductSummary) => void;
  readonly onAddAllToCart: (products: readonly ProductSummary[]) => void;
  readonly adding?: boolean;
}

export function PostProductsSheet({ products, onClose, onPressProduct, onAddProduct, onAddAllToCart, adding }: PostProductsSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <BottomSheet visible={products !== null} onClose={onClose} title="In this post" floating>
      <View style={styles.list}>
        {(products ?? []).map((product) => (
          <Pressable
            key={product.id}
            accessibilityRole="button"
            accessibilityLabel={`${product.name}, ${formatMoneyForDisplay(product.price, { showDecimals: false })}`}
            onPress={() => onPressProduct(product.id)}
            style={styles.item}
          >
            <View style={styles.row}>
              <View style={styles.thumbnail}>
                {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </View>
              <Text size={14} lineHeight={16.8} numberOfLines={1} style={styles.name}>
                {product.name}
              </Text>
              <Text size={14} weight={600} lineHeight={16.8}>
                {formatMoneyForDisplay(product.price, { showDecimals: false })}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add ${product.name} to cart`}
                hitSlop={12}
                onPress={() => onAddProduct(product)}
                style={styles.addButton}
              >
                <Plus16Icon color={colors.primary} />
              </Pressable>
            </View>
            <View style={styles.divider} />
          </Pressable>
        ))}
      </View>
      {(products?.length ?? 0) > 1 ? (
        <Button
          title="Add all to Cart"
          height={44}
          loading={adding}
          onPress={() => products && onAddAllToCart(products)}
          style={styles.button}
        />
      ) : null}
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { paddingHorizontal: 5, gap: 12 },
  item: { paddingHorizontal: 4, gap: 9 },
  row: { height: 40, flexDirection: "row", alignItems: "center", gap: 8 },
  thumbnail: { width: 40, height: 40, borderRadius: 4, backgroundColor: colors.avatar, overflow: "hidden" },
  addButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  name: { flex: 1 },
  divider: { height: 1, backgroundColor: colors.divider },
  button: { marginHorizontal: 5, marginTop: 16, marginBottom: 27 },
}));
