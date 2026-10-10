"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { RetryButton } from "@/components/ui/controls";
import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { sellerService } from "@/services/seller.service";

import styles from "../../page.module.css";

export default function EditSellerProductPage() {
  const params = useParams<{ productId: string }>();
  const productId = params.productId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const product = useQuery({ queryKey: ["seller", "product", productId], queryFn: () => sellerService.fetchStoreProductById(productId) });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceText, setPriceText] = useState("");
  const [stockText, setStockText] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (product.data) {
      setName(product.data.name);
      setDescription(product.data.description);
      setPriceText((product.data.price.amountMinor / 100).toFixed(2));
      setStockText(String(product.data.stock));
    }
  }, [product.data]);
  const save = useMutation({
    mutationFn: () => {
      const amountMinor = Math.round(Number.parseFloat(priceText || "0") * 100);
      const stock = Number.parseInt(stockText || "0", 10);
      return sellerService.updateStoreProduct(productId, { name: name.trim(), description: description.trim(), price: { amountMinor, currency: product.data?.price.currency ?? "NGN" }, stock, sizes: [], colors: [], imageUrls: product.data?.imageUrls ?? [] });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller", "products"] });
      showToast({ text: "Product updated" });
      router.push("/seller/products");
    },
    onError: (mutationError) => setError(readErrorMessageForDisplay(mutationError)),
  });
  if (product.isLoading) return <ListRowsSkeleton label="Loading product" rows={5} />;
  if (product.isError || !product.data) return <ErrorState description="We couldn't load this product." action={<RetryButton onRetry={() => product.refetch()} />} />;
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Edit product</h1>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label className={styles.field}>Name
          <input className={styles.input} value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className={styles.field}>Description
          <textarea className={styles.textarea} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className={styles.field}>Price
          <input className={styles.input} value={priceText} onChange={(event) => setPriceText(event.target.value)} inputMode="decimal" required />
        </label>
        <label className={styles.field}>Stock
          <input className={styles.input} value={stockText} onChange={(event) => setStockText(event.target.value)} inputMode="numeric" required />
        </label>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <button type="submit" className={styles.primary} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</button>
      </form>
    </div>
  );
}
