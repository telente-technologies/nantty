"use client";

import { useState } from "react";

import { requestConfirmation } from "@zudomart/web-kit";

import { PlanLockedNotice } from "@/components/billing/planGate";
import { CompactSelect } from "@/components/catalog/productListFilters";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toastProvider";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { ProductCategory } from "@/types/catalog.type";
import type { CursorPage } from "@/types/pagination.type";
import type { ProductBulkAction, ProductBulkActionRequest, ProductBulkActionResult } from "@/types/productRequests.type";

import styles from "./productBulkActionBar.module.css";

const confirmationByAction: Record<ProductBulkAction, string> = {
  publish: "Listed",
  unpublish: "Removed from the marketplace:",
  archive: "Archived",
  set_category: "Moved",
  set_visibility: "Changed visibility of",
  change_price_percent: "Repriced",
};

export function ProductBulkActionBar({ selectedProductIds, onFinished }: { readonly selectedProductIds: string[]; readonly onFinished: () => void }) {
  const { showToast } = useToast();
  const { hasFeature } = usePlanFeatures();
  const categoriesQuery = useSellerQuery<CursorPage<ProductCategory>>(hasFeature("bulk_tools") ? "/seller/categories" : null);
  const [runningAction, setRunningAction] = useState<ProductBulkAction | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [percentText, setPercentText] = useState("");

  if (!hasFeature("bulk_tools")) {
    return <PlanLockedNotice feature="bulk_tools" compact description={`You selected ${selectedProductIds.length} product(s). Publishing, archiving, recategorising and repricing many products at once is part of Pro. You can still edit each product on its own.`} />;
  }

  async function applyBulkActionToSelectedProducts(action: ProductBulkAction, extra: Omit<ProductBulkActionRequest, "action" | "productIds"> = {}) {
    if (action === "archive" && !(await requestConfirmation({ title: `Archive ${selectedProductIds.length} product(s)?`, description: "They are removed from the marketplace.", confirmLabel: "Archive", intent: "archive" }))) return;
    setRunningAction(action);
    try {
      const result = await sendSellerApiRequest<ProductBulkActionResult>("/seller/products/bulk", { method: "POST", body: { action, productIds: selectedProductIds, ...extra } });
      const skippedCount = selectedProductIds.length - result.updatedProductIds.length;
      showToast(`${confirmationByAction[action]} ${result.updatedProductIds.length} product(s).${skippedCount > 0 ? ` ${skippedCount} skipped: only active products with a photo can be listed.` : ""}`, skippedCount > 0 ? "info" : "success");
      onFinished();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setRunningAction(null);
    }
  }

  async function applyPercentagePriceChange() {
    const percent = Number(percentText.replace(",", "."));
    if (!Number.isFinite(percent) || percent === 0 || percent < -90 || percent > 500) {
      showToast("Enter a change between −90 and 500 percent, for example 10 or −15.", "error");
      return;
    }
    if (!(await requestConfirmation({ title: `Change prices by ${percent > 0 ? "+" : ""}${percent}%?`, description: `Every variant in ${selectedProductIds.length} product(s) gets the new price.`, confirmLabel: "Change prices", intent: "tag" }))) return;
    void applyBulkActionToSelectedProducts("change_price_percent", { pricePercentBasisPoints: Math.round(percent * 100) });
  }

  const isBusy = runningAction !== null;
  return (
    <div role="region" aria-label="Bulk actions" className={styles.bar}>
      <strong>{selectedProductIds.length} selected</strong>
      <div className={styles.group}>
        <Button size="small" onClick={() => void applyBulkActionToSelectedProducts("publish")} isBusy={runningAction === "publish"} disabled={isBusy}>List on Zudomart</Button>
        <Button size="small" onClick={() => void applyBulkActionToSelectedProducts("unpublish")} isBusy={runningAction === "unpublish"} disabled={isBusy}>Unlist</Button>
        <Button size="small" variant="ghost" onClick={() => void applyBulkActionToSelectedProducts("archive")} isBusy={runningAction === "archive"} disabled={isBusy}>Archive</Button>
      </div>
      <div className={styles.group}>
        <CompactSelect label="Move to category" value={categoryId} onChange={setCategoryId} options={[["", "No category"], ...(categoriesQuery.data?.data ?? []).map((category): [string, string] => [category.id, category.name])]} />
        <Button size="small" onClick={() => void applyBulkActionToSelectedProducts("set_category", { categoryId: categoryId || null })} isBusy={runningAction === "set_category"} disabled={isBusy}>Move</Button>
      </div>
      <div className={styles.group}>
        <CompactSelect label="Visibility" value={visibility} onChange={setVisibility} options={[["public", "Everyone"], ["store_only", "Store page only"], ["link_only", "Link only"]]} />
        <Button size="small" onClick={() => void applyBulkActionToSelectedProducts("set_visibility", { visibility: visibility as ProductBulkActionRequest["visibility"] })} isBusy={runningAction === "set_visibility"} disabled={isBusy}>Set</Button>
      </div>
      <div className={styles.group}>
        <label className={styles.percentField}>
          <span className="visuallyHidden">Price change in percent</span>
          <input inputMode="decimal" placeholder="±%" value={percentText} maxLength={6} onChange={(event) => setPercentText(event.target.value.replace(/[^\d.,-]/g, ""))} />
        </label>
        <Button size="small" onClick={applyPercentagePriceChange} isBusy={runningAction === "change_price_percent"} disabled={isBusy || percentText.trim() === ""}>Change prices</Button>
      </div>
    </div>
  );
}
