import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useState } from "react";

import { VariantPickerSheet } from "@/components/product/variantPickerSheet";
import { useCartActions } from "@/hooks/useCart.hook";
import type { MainStackParamList } from "@/navigation/navigation.types";
import type { ProductSummary } from "@/types";
import { requireAuthAfterClosingModal, requireAuthThen } from "@/utils/requireAuth.util";

import { PostProductsSheet } from "./postProductsSheet";

export interface PostProductsFlowProps {
  readonly products: readonly ProductSummary[] | null;
  readonly onClose: () => void;
}

export function PostProductsFlow({ products, onClose }: PostProductsFlowProps) {
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const [variantPickerProductId, setVariantPickerProductId] = useState<string | null>(null);
  const { addProductToCart } = useCartActions();

  const addEveryPostProductToCart = (all: readonly ProductSummary[]) =>
    requireAuthAfterClosingModal(
      onClose,
      async () => {
        for (const product of all) await addProductToCart.mutateAsync({ productId: product.id, quantity: 1 });
        onClose();
        navigation.navigate("Cart");
      },
      "add to cart",
    );

  const addSinglePostProductToCart = (product: ProductSummary) =>
    requireAuthThen(
      () => {
        if (product.hasVariants || (product.variantGroups?.length ?? 0) > 0) {
          setVariantPickerProductId(product.id);
          return;
        }
        addProductToCart.mutate({ productId: product.id, quantity: 1 });
      },
      undefined,
      "add to cart",
    );

  return (
    <>
      <PostProductsSheet
        products={products}
        onClose={onClose}
        onPressProduct={(productId) => {
          onClose();
          navigation.navigate("ProductDetail", { productId });
        }}
        onAddProduct={addSinglePostProductToCart}
        onAddAllToCart={addEveryPostProductToCart}
        adding={addProductToCart.isPending}
      />
      <VariantPickerSheet
        productId={variantPickerProductId}
        onClose={() => setVariantPickerProductId(null)}
        onAddedToCart={() => {
          setVariantPickerProductId(null);
          navigation.navigate("Cart");
        }}
      />
    </>
  );
}
