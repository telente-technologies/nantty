"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { sellerService } from "@/services/seller.service";

import styles from "../../page.module.css";

export default function NewSellerProductPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceText, setPriceText] = useState("");
  const [stockText, setStockText] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => {
      const amountMinor = Math.round(Number.parseFloat(priceText || "0") * 100);
      const stock = Number.parseInt(stockText || "0", 10);
      if (!name.trim()) throw new Error("Give your product a name.");
      if (!Number.isFinite(amountMinor) || amountMinor <= 0) throw new Error("Enter a valid price.");
      if (!Number.isFinite(stock) || stock < 0) throw new Error("Enter a valid stock quantity.");
      return sellerService.createStoreProduct({ name: name.trim(), description: description.trim(), price: { amountMinor, currency: "NGN" }, stock, sizes: [], colors: [], imageUrls: [] });
    },
    onSuccess: (product) => {
      void queryClient.invalidateQueries({ queryKey: ["seller", "products"] });
      showToast({ text: "Product created" });
      router.push(`/seller/products/${product.id}`);
    },
    onError: (mutationError) => setError(readErrorMessageForDisplay(mutationError)),
  });
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Add product</h1>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <label className={styles.field}>Name
          <input className={styles.input} value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className={styles.field}>Description
          <textarea className={styles.textarea} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className={styles.field}>Price
          <input className={styles.input} value={priceText} onChange={(event) => setPriceText(event.target.value)} placeholder="0.00" inputMode="decimal" required />
        </label>
        <label className={styles.field}>Stock
          <input className={styles.input} value={stockText} onChange={(event) => setStockText(event.target.value)} inputMode="numeric" required />
        </label>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <button type="submit" className={styles.primary} disabled={create.isPending}>{create.isPending ? "Saving…" : "Create product"}</button>
      </form>
    </div>
  );
}
