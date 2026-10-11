import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { reviewsService } from "@/services/catalog/reviews.service";
import { useAuthStore } from "@/store/auth.store";
import { useReviewedProductsStore } from "@/store/reviewedProducts.store";
import { showToast } from "@/store/toast.store";
import { showDialog } from "@/store/dialog.store";

export const reviewQueryKeys = {
  all: (productId: string) => ["products", "reviews", productId] as const,
  summary: (productId: string) => ["products", "reviews", productId, "summary"] as const,
  preview: (productId: string) => ["products", "reviews", productId, "preview"] as const,
  list: (productId: string) => ["products", "reviews", productId, "list"] as const,
};

export const useRatingSummaryQuery = (productId: string) =>
  useQuery({ queryKey: reviewQueryKeys.summary(productId), queryFn: () => reviewsService.fetchRatingSummary(productId) });

export const useReviewPreviewQuery = (productId: string) =>
  useQuery({ queryKey: reviewQueryKeys.preview(productId), queryFn: () => reviewsService.fetchProductReviews(productId, null, 3) });

export const useViewerAccountId = () => useAuthStore((state) => state.user?.id ?? null);

export function useInvalidateProductReviews() {
  const queryClient = useQueryClient();
  return (productId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all(productId) }),
      queryClient.invalidateQueries({ queryKey: ["products", "detail", productId] }),
    ]);
}

export function useDeleteOwnReview(productId: string) {
  const invalidate = useInvalidateProductReviews();
  const unmarkReviewed = useReviewedProductsStore((state) => state.unmarkReviewed);
  const mutation = useMutation({
    mutationFn: (reviewId: string) => reviewsService.deleteOwnReview(reviewId),
    onSuccess: () => {
      unmarkReviewed(productId);
      showToast("Review deleted", { tone: "success" });
      return invalidate(productId);
    },
    onError: () => showToast("Couldn't delete your review. Try again.", { tone: "error" }),
  });
  const confirmDelete = (reviewId: string) =>
    showDialog({
      title: "Delete your review?",
      intent: "delete",
      message: "Your rating and review will be removed from this product.",
      actions: [
        { label: "Cancel", style: "secondary" },
        { label: "Delete", style: "destructive", onPress: () => mutation.mutate(reviewId) },
      ],
    });
  return { confirmDelete, isDeleting: mutation.isPending };
}
