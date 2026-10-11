"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { SellerProductForm } from "@/components/seller/sellerProductForm";
import { requestConfirmation } from "@/components/ui/confirmDialog";
import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import { sellerService } from "@/services/seller.service";

import styles from "../../page.module.css";

export default function EditSellerProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const product = useQuery({ queryKey: ["seller", "product", productId], queryFn: () => sellerService.fetchStoreProductById(productId), retry: false, refetchOnWindowFocus: false });
  const archive = useMutation({
    mutationFn: () => sellerService.archiveStoreProduct(productId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller", "products"] });
      showToast({ text: "Product deleted" });
      router.replace("/seller/products");
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });

  if (product.isLoading) return <ListRowsSkeleton label="Loading product" rows={5} />;
  if (!product.data) {
    const gone = product.error instanceof WebappRequestError && (product.error.status === 404 || product.error.status === 403);
    return gone
      ? <ErrorState kind="contentGone" subject="product" title="This product isn't available" description="It may have been deleted, or it belongs to another store." action={<Link href="/seller/products">Your products</Link>} />
      : <ErrorState description="We couldn't load this product." error={product.error} onRetry={() => void product.refetch()} />;
  }

  const confirmAndArchive = async () => {
    if (archive.isPending) return;
    const confirmed = await requestConfirmation({ title: "Delete this product?", description: "Buyers won't see it any more. Past orders keep their details.", confirmLabel: "Delete product", cancelLabel: "Keep", intent: "delete" });
    if (confirmed) archive.mutate();
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Edit product</h1>
      <SellerProductForm
        key={productId}
        existing={product.data}
        submitLabel="Save changes"
        onSubmit={async (request) => {
          await sellerService.updateStoreProduct(productId, request);
          void queryClient.invalidateQueries({ queryKey: ["seller"] });
          showToast({ text: "Product updated" });
          router.replace("/seller/products");
        }}
      />
      <button type="button" className={styles.linkButton} disabled={archive.isPending} onClick={() => void confirmAndArchive()}>Delete product</button>
    </div>
  );
}
