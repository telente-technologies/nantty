import { useQueryClient } from "@tanstack/react-query";

import { productsService } from "@/services/products.service";
import type { ProductSummary } from "@/types";

export function useProductLikeToggle() {
  const queryClient = useQueryClient();
  return async (product: ProductSummary) => {
    const likeNow = !product.liked;
    try {
      await (likeNow ? productsService.likeProduct(product.id) : productsService.unlikeProduct(product.id));
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    }
  };
}
