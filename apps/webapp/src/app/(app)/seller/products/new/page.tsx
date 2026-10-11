"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { SellerProductForm } from "@/components/seller/sellerProductForm";
import { showToast } from "@/components/ui/toast";
import { createIdempotencyKey } from "@/services/clientApi.service";
import { sellerService } from "@/services/seller.service";

import styles from "../../page.module.css";

export default function NewSellerProductPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const idempotencyKey = useRef(createIdempotencyKey("product"));
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>New product</h1>
      <SellerProductForm
        existing={null}
        submitLabel="Publish product"
        onSubmit={async (request) => {
          const product = await sellerService.createStoreProduct(request, idempotencyKey.current);
          void queryClient.invalidateQueries({ queryKey: ["seller", "products"] });
          showToast({ text: "Product published" });
          router.replace(`/seller/products/${encodeURIComponent(product.id)}`);
        }}
      />
    </div>
  );
}
