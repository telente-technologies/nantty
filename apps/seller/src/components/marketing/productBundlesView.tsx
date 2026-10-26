"use client";

import { useState } from "react";

import { requestConfirmation } from "@nantty/web-kit";

import { PlanGate } from "@/components/billing/planGate";
import { MarketingSectionHeader } from "@/components/marketing/marketingSectionHeader";
import { ProductBundleEditorDialog } from "@/components/marketing/productBundleEditorDialog";
import { useCommerceCursorList } from "@/components/orders/commerceCursorList.hook";
import { Button } from "@/components/ui/button";
import { Callout, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { PageStack } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { ProductBundle } from "@/types/marketing.type";

import styles from "./marketing.module.css";

function ProductBundleCard({ bundle, onEdit, onDelete }: { readonly bundle: ProductBundle; readonly onEdit: () => void; readonly onDelete: () => void }) {
  const { formatMoney } = useMoneyFormatter();
  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <div>
          <p className={styles.cardTitle}>{bundle.name}</p>
          <p className={styles.muted}>{bundle.description || "No description"}</p>
        </div>
        <StatusBadge tone={bundle.status === "active" ? "success" : bundle.status === "paused" ? "caution" : "neutral"}>{bundle.status === "active" ? "Active" : bundle.status === "paused" ? "Paused" : "Draft"}</StatusBadge>
      </header>
      <ul className={styles.itemList}>
        {bundle.items.map((item) => (
          <li key={item.productId} className={styles.itemRow}>
            {item.imageUrl ? <img src={item.imageUrl} alt="" width={32} height={32} className={styles.thumbnail} /> : <span className={styles.thumbnail} aria-hidden="true" />}
            <span className={styles.itemName}>{item.quantity} × {item.productName}</span>
          </li>
        ))}
      </ul>
      <p className={styles.priceLine}>
        <strong>{formatMoney(bundle.bundlePrice)}</strong>
        <span className={styles.strike}>{formatMoney(bundle.regularPrice)}</span>
      </p>
      <p className={styles.muted}>{bundle.soldCount} sold · {formatMoney(bundle.revenue)}</p>
      <div className={styles.cardActions}>
        <Button size="small" onClick={onEdit}>Edit</Button>
        <Button size="small" variant="ghost" onClick={onDelete}>Delete</Button>
      </div>
    </article>
  );
}

function ProductBundlesBoard() {
  const { showToast } = useToast();
  const { currency } = useMoneyFormatter();
  const bundlesList = useCommerceCursorList<ProductBundle>("/seller/marketing/bundles", { limit: 50 });
  const [editingBundle, setEditingBundle] = useState<ProductBundle | "new" | null>(null);

  async function deleteBundle(bundle: ProductBundle) {
    if (!(await requestConfirmation({ title: `Delete ${bundle.name}?`, description: "Orders already placed are not affected.", confirmLabel: "Delete bundle", tone: "danger", intent: "delete" }))) return;
    try {
      await sendSellerApiRequest(`/seller/marketing/bundles/${encodeURIComponent(bundle.id)}`, { method: "DELETE" });
      showToast("Bundle deleted.");
      bundlesList.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    }
  }

  return (
    <>
      <div><Button variant="primary" iconName="plus16" onClick={() => setEditingBundle("new")}>New bundle</Button></div>
      {bundlesList.isLoading && bundlesList.items.length === 0 ? <LoadingBlock label="Loading bundles" /> : null}
      {bundlesList.errorMessage ? <Callout tone="error" action={<Button size="small" onClick={bundlesList.reload}>Try again</Button>}>{bundlesList.errorMessage}</Callout> : null}
      {!bundlesList.isLoading && !bundlesList.errorMessage && bundlesList.items.length === 0 ? <EmptyState iconName="tag24" title="No bundles yet" description="Pair products people buy together and give them a reason to add more." /> : null}
      <div className={styles.cardGrid}>
        {bundlesList.items.map((bundle) => <ProductBundleCard key={bundle.id} bundle={bundle} onEdit={() => setEditingBundle(bundle)} onDelete={() => void deleteBundle(bundle)} />)}
      </div>
      {editingBundle && currency ? (
        <ProductBundleEditorDialog
          bundle={editingBundle === "new" ? null : editingBundle}
          currency={currency}
          onClose={() => setEditingBundle(null)}
          onSaved={() => {
            setEditingBundle(null);
            bundlesList.reload();
          }}
        />
      ) : null}
    </>
  );
}

export function ProductBundlesView() {
  const { hasFeature } = usePlanFeatures();
  return (
    <PageStack>
      <MarketingSectionHeader title="Bundles" description="Group products and sell them together for one lower price." />
      <PlanGate feature="advanced_promotions" description="Bundles raise your average order by selling products together for one price. Available on Pro and Business.">
        {hasFeature("advanced_promotions") ? <ProductBundlesBoard /> : null}
      </PlanGate>
    </PageStack>
  );
}
