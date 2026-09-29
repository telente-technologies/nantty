"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { ProductBulkAction, ProductBulkActionResult } from "@/types/productRequests.type";

const confirmationByAction: Record<ProductBulkAction, string> = {
  publish: "Published",
  unpublish: "Removed from the marketplace:",
  archive: "Archived",
};

export function ProductBulkActionBar({ selectedProductIds, onFinished }: { readonly selectedProductIds: string[]; readonly onFinished: () => void }) {
  const { showToast } = useToast();
  const [runningAction, setRunningAction] = useState<ProductBulkAction | null>(null);

  async function applyBulkActionToSelectedProducts(action: ProductBulkAction) {
    if (action === "archive" && !window.confirm(`Archive ${selectedProductIds.length} product(s)? They leave the register and the marketplace.`)) return;
    setRunningAction(action);
    try {
      const result = await sendSellerApiRequest<ProductBulkActionResult>("/seller/products/bulk", { method: "POST", body: { action, productIds: selectedProductIds } });
      const skippedCount = selectedProductIds.length - result.updatedProductIds.length;
      showToast(`${confirmationByAction[action]} ${result.updatedProductIds.length} product(s).${skippedCount > 0 ? ` ${skippedCount} skipped: only active products with a photo can be published.` : ""}`, skippedCount > 0 ? "info" : "success");
      onFinished();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <div role="region" aria-label="Bulk actions" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "var(--blue-tint)" }}>
      <strong>{selectedProductIds.length} selected</strong>
      <Button size="small" onClick={() => void applyBulkActionToSelectedProducts("publish")} isBusy={runningAction === "publish"} disabled={runningAction !== null}>Publish online</Button>
      <Button size="small" onClick={() => void applyBulkActionToSelectedProducts("unpublish")} isBusy={runningAction === "unpublish"} disabled={runningAction !== null}>Unpublish</Button>
      <Button size="small" variant="ghost" onClick={() => void applyBulkActionToSelectedProducts("archive")} isBusy={runningAction === "archive"} disabled={runningAction !== null}>Archive</Button>
    </div>
  );
}
