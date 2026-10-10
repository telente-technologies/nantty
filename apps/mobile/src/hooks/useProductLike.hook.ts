import { useQueryClient } from "@tanstack/react-query";

import { updateMatchingRecordsInEveryQuery } from "@/cache/postEngagementCache.util";
import { productsService } from "@/services/sellers/products.service";
import { showToast } from "@/store/toast.store";
import type { ProductSummary } from "@/types";
import { requireAuthThen } from "@/utils/requireAuth.util";

const productsWithLikeStatesInFlight = new Set<string>();

export function useProductLikeToggle() {
  const queryClient = useQueryClient();
  const setProductLikedEverywhere = (productId: string, liked: boolean) =>
    updateMatchingRecordsInEveryQuery(
      queryClient,
      (record) => record.id === productId && typeof record.liked === "boolean" && "price" in record,
      (product) => (product.liked === liked ? product : { ...product, liked }),
    );
  const applyProductLikeToggle = async (product: ProductSummary) => {
    if (productsWithLikeStatesInFlight.has(product.id)) return;
    productsWithLikeStatesInFlight.add(product.id);
    const likeNow = !product.liked;
    setProductLikedEverywhere(product.id, likeNow);
    try {
      await (likeNow ? productsService.likeProduct(product.id) : productsService.unlikeProduct(product.id));
    } catch {
      setProductLikedEverywhere(product.id, !likeNow);
      showToast("Couldn't update your like. Try again.", { tone: "error" });
    } finally {
      productsWithLikeStatesInFlight.delete(product.id);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    }
  };
  return (product: ProductSummary) => requireAuthThen(() => applyProductLikeToggle(product), undefined, "like products");
}
