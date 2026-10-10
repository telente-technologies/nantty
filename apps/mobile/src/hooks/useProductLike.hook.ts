import { useQueryClient } from "@tanstack/react-query";

import { productsService } from "@/services/sellers/products.service";
import type { ProductSummary } from "@/types";
import { requireAuthThen } from "@/utils/requireAuth.util";

export function useProductLikeToggle() {
  const queryClient = useQueryClient();
  const applyProductLikeToggle = async (product: ProductSummary) => {
    const likeNow = !product.liked;
    try {
      await (likeNow ? productsService.likeProduct(product.id) : productsService.unlikeProduct(product.id));
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    }
  };
  return (product: ProductSummary) => requireAuthThen(() => applyProductLikeToggle(product), undefined, "like products");
}
