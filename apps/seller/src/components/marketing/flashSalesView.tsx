"use client";

import { useEffect, useState } from "react";

import { requestConfirmation } from "@nantty/web-kit";

import { PlanGate } from "@/components/billing/planGate";
import { FlashSaleCard, type FlashSaleAction } from "@/components/marketing/flashSaleCard";
import { FlashSaleEditorDialog } from "@/components/marketing/flashSaleEditorDialog";
import { MarketingSectionHeader } from "@/components/marketing/marketingSectionHeader";
import { useCommerceCursorList } from "@/components/orders/commerceCursorList.hook";
import { Button } from "@/components/ui/button";
import { Callout, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { PageStack } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { FlashSale, MarketingCampaignStatus } from "@/types/marketing.type";

import styles from "./marketing.module.css";

function FlashSalesBoard() {
  const { showToast } = useToast();
  const { currency } = useMoneyFormatter();
  const [statusFilter, setStatusFilter] = useState<MarketingCampaignStatus | "all">("all");
  const salesList = useCommerceCursorList<FlashSale>("/seller/marketing/flash-sales", { status: statusFilter === "all" ? undefined : statusFilter, limit: 50 });
  const [editingSale, setEditingSale] = useState<FlashSale | "new" | null>(null);
  const [busy, setBusy] = useState<{ saleId: string; action: FlashSaleAction } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalHandle = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(intervalHandle);
  }, []);

  async function runFlashSaleAction(sale: FlashSale, action: FlashSaleAction) {
    if (action === "edit") return setEditingSale(sale);
    if (action === "delete" && !(await requestConfirmation({ title: `Delete ${sale.name}?`, description: "This can't be undone.", confirmLabel: "Delete sale", tone: "danger", intent: "delete" }))) return;
    if (action === "end" && !(await requestConfirmation({ title: `End ${sale.name} now?`, description: "Prices go back to normal straight away.", confirmLabel: "End sale", tone: "danger", intent: "stop" }))) return;
    setBusy({ saleId: sale.id, action });
    try {
      if (action === "delete") await sendSellerApiRequest(`/seller/marketing/flash-sales/${encodeURIComponent(sale.id)}`, { method: "DELETE" });
      else await sendSellerApiRequest(`/seller/marketing/flash-sales/${encodeURIComponent(sale.id)}`, { method: "PATCH", body: { action } });
      showToast(action === "delete" ? "Flash sale deleted." : action === "end" ? "Flash sale ended." : action === "pause" ? "Flash sale paused." : "Flash sale is live again.");
      salesList.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className={styles.cardActions}>
        <SegmentedControl label="Filter flash sales" value={statusFilter} onValueChange={setStatusFilter} options={[{ value: "all", label: "All" }, { value: "active", label: "Live" }, { value: "scheduled", label: "Scheduled" }, { value: "paused", label: "Paused" }, { value: "ended", label: "Ended" }]} />
        <Button variant="primary" iconName="plus16" onClick={() => setEditingSale("new")}>New flash sale</Button>
      </div>
      {salesList.isLoading && salesList.items.length === 0 ? <LoadingBlock label="Loading flash sales" /> : null}
      {salesList.errorMessage ? <Callout tone="error" action={<Button size="small" onClick={salesList.reload}>Try again</Button>}>{salesList.errorMessage}</Callout> : null}
      {!salesList.isLoading && !salesList.errorMessage && salesList.items.length === 0 ? <EmptyState iconName="star16" title="No flash sales here" description="Run a few hours of deep discounts to clear stock or reward followers." /> : null}
      <div className={styles.cardGrid}>
        {salesList.items.map((sale) => <FlashSaleCard key={sale.id} sale={sale} now={now} busyAction={busy?.saleId === sale.id ? busy.action : null} onAction={(action) => void runFlashSaleAction(sale, action)} />)}
      </div>
      {salesList.hasMore ? <Button onClick={salesList.loadMore} isBusy={salesList.isLoadingMore}>Load more</Button> : null}
      {editingSale && currency ? (
        <FlashSaleEditorDialog
          sale={editingSale === "new" ? null : editingSale}
          currency={currency}
          onClose={() => setEditingSale(null)}
          onSaved={() => {
            setEditingSale(null);
            salesList.reload();
          }}
        />
      ) : null}
    </>
  );
}

export function FlashSalesView() {
  const { hasFeature } = usePlanFeatures();
  return (
    <PageStack>
      <MarketingSectionHeader title="Flash sales" description="Time-boxed price drops with a live countdown and optional stock caps, shown to buyers in the Nantty app." />
      <PlanGate feature="advanced_promotions" description="Flash sales put a countdown on your products in the app and stop the deal when the time or stock runs out. Available on Pro and Business.">
        {hasFeature("advanced_promotions") ? <FlashSalesBoard /> : null}
      </PlanGate>
    </PageStack>
  );
}
