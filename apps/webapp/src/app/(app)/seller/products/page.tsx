"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { sellerService } from "@/services/seller.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "../page.module.css";

export default function SellerProductsPage() {
  const queryClient = useQueryClient();
  const products = useQuery({ queryKey: ["seller", "products"], queryFn: () => sellerService.listMyStoreProducts() });
  const remove = useMutation({
    mutationFn: (id: string) => sellerService.deleteStoreProduct(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller", "products"] });
      showToast({ text: "Product deleted" });
    },
    onError: (mutationError) => showToast({ text: readErrorMessageForDisplay(mutationError), tone: "error" }),
  });
  const togglePublish = useMutation({
    mutationFn: (input: { id: string; published: boolean }) => (input.published ? sellerService.unpublishStoreProduct(input.id) : sellerService.publishStoreProduct(input.id)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["seller", "products"] }),
    onError: (mutationError) => showToast({ text: readErrorMessageForDisplay(mutationError), tone: "error" }),
  });
  if (products.isLoading) return <ListRowsSkeleton label="Loading products" rows={6} />;
  if (products.isError || !products.data) return <ErrorState description="We couldn't load your products." action={<RetryButton onRetry={() => products.refetch()} />} />;
  return (
    <div className={styles.page}>
      <div className={styles.sectionHead}>
        <h1 className={styles.title}>Products</h1>
        <Link className={styles.primary} href="/seller/products/new">Add product</Link>
      </div>
      {products.data.length === 0 ? (
        <EmptyState title="No products yet" description="Add your first product to start selling." />
      ) : (
        <ul className={styles.list}>
          {products.data.map((product) => (
            <li key={product.id} className={styles.row}>
              <span className={styles.rowMain}>
                <Link className={styles.rowTitle} href={`/seller/products/${product.id}`}>{product.name}</Link>
                <span className={styles.rowMeta}>Stock {product.stock} · {product.published ? "Published" : "Hidden"}</span>
              </span>
              <span className={styles.amount}>{formatMoneyForDisplay(product.price)}</span>
              <button type="button" className={styles.linkButton} disabled={togglePublish.isPending} onClick={() => togglePublish.mutate({ id: product.id, published: product.published })}>
                {product.published ? "Hide" : "Publish"}
              </button>
              <button type="button" className={styles.linkButton} disabled={remove.isPending} onClick={() => remove.mutate(product.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
