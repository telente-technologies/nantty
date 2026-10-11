"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { InventoryTabs } from "@/components/inventory/inventoryTabs";
import { LocationPicker } from "@/components/inventory/inventoryLevelsView";
import { NewStockAdjustmentDialog, stockAdjustmentReasonLabels } from "@/components/inventory/newStockAdjustmentDialog";
import type { PickedVariant } from "@/components/inventory/variantLinePicker";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState, ErrorCallout } from "@/components/ui/feedback";
import { FilterBar } from "@/components/ui/filterControls";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { useCursorPagedList } from "@/hooks/useCursorPagedList.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { sendSellerApiRequest } from "@/services/clientApi.service";
import type { Product, StockAdjustment, StockAdjustmentReason } from "@/types/catalog.type";
import type { CursorPage } from "@/types/pagination.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./inventoryViews.module.css";

export function StockAdjustmentsView({ initialVariantId, initialLocationId, shouldOpenForm }: { readonly initialVariantId: string | null; readonly initialLocationId: string | null; readonly shouldOpenForm: boolean }) {
  const router = useRouter();
  const { selectedLocationId, locations } = useStoreContext();
  const [filterLocationId, setFilterLocationId] = useState(initialLocationId ?? "");
  const [reasonFilter, setReasonFilter] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(shouldOpenForm || initialVariantId !== null);
  const [initialVariant, setInitialVariant] = useState<PickedVariant | null>(null);
  const locationId = filterLocationId || selectedLocationId || locations[0]?.id || "";
  const adjustments = useCursorPagedList<StockAdjustment>("/seller/inventory/adjustments", { locationId, reason: reasonFilter, limit: 25 });

  useEffect(() => {
    if (!initialVariantId) return;
    sendSellerApiRequest<CursorPage<Product>>("/seller/products", { query: { variantId: initialVariantId, status: "all", limit: 1 } })
      .then((page) => {
        const product = page.data[0];
        const variant = product?.variants.find((candidate) => candidate.id === initialVariantId);
        if (product && variant) setInitialVariant({ productName: product.name, variant });
      })
      .catch(() => undefined);
  }, [initialVariantId]);

  const locationNameById = new Map(locations.map((location) => [location.id, location.name]));
  const columns: DataTableColumn<StockAdjustment>[] = [
    { key: "when", header: "When", render: (adjustment) => formatDateTimeForDisplay(adjustment.createdAt) },
    { key: "item", header: "Item", render: (adjustment) => `${adjustment.productName}${adjustment.variantTitle !== "Default" ? ` · ${adjustment.variantTitle}` : ""}` },
    { key: "change", header: "Change", align: "end", render: (adjustment) => <span className={`${styles.delta} ${adjustment.quantityDelta > 0 ? styles.deltaUp : styles.deltaDown}`}>{adjustment.quantityDelta > 0 ? `+${adjustment.quantityDelta}` : adjustment.quantityDelta}</span> },
    { key: "reason", header: "Reason", render: (adjustment) => stockAdjustmentReasonLabels[adjustment.reason] },
    { key: "location", header: "Location", hideBelowTablet: true, render: (adjustment) => locationNameById.get(adjustment.locationId) ?? adjustment.locationId },
    { key: "by", header: "By", hideBelowTablet: true, render: (adjustment) => adjustment.createdBy.name },
    { key: "note", header: "Note", hideBelowTablet: true, render: (adjustment) => adjustment.note ?? "—" },
  ];

  return (
    <PageStack>
      <PageHeader title="Stock adjustments" description="Deliveries, counts, damage and losses. Each change updates the stock customers can buy in the Zudomart app." actions={<Button variant="primary" iconName="plus16" onClick={() => setIsDialogOpen(true)}>New adjustment</Button>} />
      <InventoryTabs />
      <Panel padded={false}>
        <div className={styles.toolbar}>
          <FilterBar>
            <LocationPicker value={locationId} onValueChange={setFilterLocationId} />
            <label className={styles.inlineSelect}>
              <span className="visuallyHidden">Reason</span>
              <select aria-label="Reason" value={reasonFilter} onChange={(event) => setReasonFilter(event.target.value)}>
                <option value="">All reasons</option>
                {(Object.keys(stockAdjustmentReasonLabels) as StockAdjustmentReason[]).map((reason) => <option key={reason} value={reason}>{stockAdjustmentReasonLabels[reason]}</option>)}
              </select>
            </label>
          </FilterBar>
        </div>
        {adjustments.errorMessage ? <div className={styles.toolbar}><ErrorCallout error={adjustments.error} message={adjustments.errorMessage} onRetry={adjustments.reload} /></div> : null}
        <DataTable caption="Stock adjustments" columns={columns} rows={adjustments.items} readRowKey={(adjustment) => adjustment.id} isLoading={adjustments.isLoading} hasMore={adjustments.hasMore} onLoadMore={adjustments.loadMore} isLoadingMore={adjustments.isLoadingMore} emptyState={<EmptyState iconName="boxArrowDown24" title="No adjustments at this location yet" description="Record a delivery or a stock count to get started." />} />
      </Panel>
      <NewStockAdjustmentDialog
        isOpen={isDialogOpen}
        initialLocationId={locationId}
        initialVariant={initialVariant}
        onClose={() => { setIsDialogOpen(false); setInitialVariant(null); if (initialVariantId || shouldOpenForm) router.replace("/inventory/adjustments"); }}
        onSaved={() => { setIsDialogOpen(false); setInitialVariant(null); adjustments.reload(); }}
      />
    </PageStack>
  );
}
