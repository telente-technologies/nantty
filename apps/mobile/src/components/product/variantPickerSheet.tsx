import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, View } from "react-native";

import { Tag24Icon } from "@/components/icons";
import { OptionSelect } from "@/components/product/optionSelect";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useCartActions } from "@/hooks/useCart.hook";
import { useTheme } from "@/theme";
import { productsService } from "@/services/sellers/products.service";
import type { Product, ProductVariantGroup } from "@/types";
import { requireAuthThen } from "@/utils/requireAuth.util";

const QUANTITY_OPTIONS = Array.from({ length: 10 }, (_, i) => String(i + 1));

export interface VariantPickerSheetProps {
  readonly productId: string | null;
  readonly onClose: () => void;
  readonly onAddedToCart?: () => void;
}

export function VariantPickerSheet({ productId, onClose, onAddedToCart }: VariantPickerSheetProps) {
  const { colors } = useTheme();
  const product = useQuery({
    queryKey: ["products", "detail", productId],
    queryFn: () => productsService.fetchProductDetailById(productId!),
    enabled: !!productId,
  });
  return (
    <BottomSheet visible={!!productId} onClose={onClose} title={product.data?.name ?? "Choose options"}>
      {productId && product.data ? (
        <VariantPickerBody product={product.data} onClose={onClose} onAddedToCart={onAddedToCart} />
      ) : product.isLoading ? (
        <Text size={13} lineHeight={18} color={colors.textMuted} align="center" style={styles.loading}>
          Loading options…
        </Text>
      ) : product.isError ? (
        <View style={styles.loading}>
          <Text size={13} lineHeight={18} color={colors.error} align="center">
            Couldn&apos;t load options. Try opening the product instead.
          </Text>
          <Button title="Retry" onPress={() => product.refetch()} />
        </View>
      ) : null}
    </BottomSheet>
  );
}

function VariantPickerBody({ product, onClose, onAddedToCart }: { product: Product; onClose: () => void; onAddedToCart?: () => void }) {
  const { colors } = useTheme();
  const { addProductToCart } = useCartActions();
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const variantGroups: readonly ProductVariantGroup[] = product.variantGroups ?? [];

  const addToCart = () => {
    if (product.sizes.length > 0 && !selectedSize) {
      setError("Choose a size first.");
      return;
    }
    if (product.colors.length > 0 && !selectedColor) {
      setError("Choose a color first.");
      return;
    }
    const missing = variantGroups.find((group) => !selections[group.name]);
    if (missing) {
      setError(`Choose ${missing.name} first.`);
      return;
    }
    setError(null);
    const variants = Object.keys(selections).length > 0 ? selections : null;
    requireAuthThen(
      async () => {
        try {
          await addProductToCart.mutateAsync({ productId: product.id, quantity, size: selectedSize, color: selectedColor, variants });
          onClose();
          onAddedToCart?.();
        } catch {
          setError("Couldn't add to cart. Try again.");
        }
      },
      undefined,
      "add to cart",
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
        <Tag24Icon size={22} color={colors.textMuted} />
      </View>
      {product.sizes.length > 0 ? <OptionSelect label="Size" placeholder="Select size" options={product.sizes} value={selectedSize} onChange={setSelectedSize} /> : null}
      {product.colors.length > 0 ? <OptionSelect label="Color" placeholder="Select color" options={product.colors} value={selectedColor} onChange={setSelectedColor} /> : null}
      {variantGroups.map((group) => (
        <OptionSelect
          key={group.name}
          label={group.name}
          placeholder={`Select ${group.name.toLowerCase()}`}
          options={group.options}
          value={selections[group.name] ?? null}
          onChange={(value) => setSelections((prev) => ({ ...prev, [group.name]: value }))}
        />
      ))}
      <OptionSelect
        label="Quantity"
        placeholder="Number of items"
        options={QUANTITY_OPTIONS}
        value={String(quantity)}
        trailingValue={String(quantity)}
        onChange={(value) => setQuantity(Number(value))}
      />
      {error ? (
        <Text size={12} lineHeight={16} color={colors.error} align="center" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button title="Add to Cart" loading={addProductToCart.isPending} onPress={addToCart} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingHorizontal: 16, paddingBottom: 24 },
  loading: { gap: 12, paddingHorizontal: 16, paddingBottom: 24 },
});
