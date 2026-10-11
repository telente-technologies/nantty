"use client";

import Link from "next/link";
import { useState } from "react";

import { requestConfirmation } from "@zudomart/web-kit";

import { PlanGate } from "@/components/billing/planGate";
import { InventoryTabs } from "@/components/inventory/inventoryTabs";
import { SupplierFormDialog } from "@/components/inventory/supplierFormDialog";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
import { FilterBar, SearchInput } from "@/components/ui/filterControls";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { TablePagination } from "@/components/ui/tablePagination";
import { useToast } from "@/components/ui/toastProvider";
import { useClientTableState } from "@/hooks/useClientTableState.hook";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Supplier } from "@/types/catalog.type";
import type { CursorPage } from "@/types/pagination.type";

import styles from "./inventoryViews.module.css";

const supplierSortReaders = { name: (supplier: Supplier) => supplier.name, leadTime: (supplier: Supplier) => supplier.leadTimeDays, products: (supplier: Supplier) => supplier.productCount };

function SuppliersTable({ onEdit }: { readonly onEdit: (supplier: Supplier) => void }) {
  const { showToast } = useToast();
  const [searchText, setSearchText] = useState("");
  const [removingSupplierId, setRemovingSupplierId] = useState<string | null>(null);
  const suppliersQuery = useSellerQuery<CursorPage<Supplier>>("/seller/suppliers", { q: searchText, limit: 200 });
  const table = useClientTableState(suppliersQuery.data?.data ?? (suppliersQuery.isLoading ? null : []), supplierSortReaders, { pageSize: 10, initialSort: { key: "name", direction: "ascending" } });

  async function removeSupplier(supplier: Supplier) {
    if (!(await requestConfirmation({ title: `Remove ${supplier.name}?`, description: supplier.productCount > 0 ? `${supplier.productCount} product(s) will have no supplier.` : undefined, confirmLabel: "Remove supplier", tone: "danger", intent: "remove" }))) return;
    setRemovingSupplierId(supplier.id);
    try {
      await sendSellerApiRequest(`/seller/suppliers/${encodeURIComponent(supplier.id)}`, { method: "DELETE" });
      showToast(`${supplier.name} removed.`);
      suppliersQuery.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setRemovingSupplierId(null);
    }
  }

  const columns: DataTableColumn<Supplier>[] = [
    { key: "name", header: "Supplier", sortKey: "name", render: (supplier) => <span className={styles.itemCell}><span><strong>{supplier.name}</strong><small>{supplier.address || "No address"}</small></span></span> },
    { key: "contact", header: "Contact", render: (supplier) => <span className={styles.itemCell}><span>{supplier.contactName || "—"}<small><a href={`tel:${supplier.phone.replace(/\s/g, "")}`}>{supplier.phone}</a>{supplier.email ? ` · ${supplier.email}` : ""}</small></span></span> },
    { key: "leadTime", header: "Lead time", align: "end", sortKey: "leadTime", hideBelowTablet: true, render: (supplier) => `${supplier.leadTimeDays} days` },
    { key: "terms", header: "Payment terms", hideBelowTablet: true, render: (supplier) => supplier.paymentTerms || "—" },
    { key: "products", header: "Products", align: "end", sortKey: "products", render: (supplier) => <Link href={`/products?supplierId=${encodeURIComponent(supplier.id)}&status=all`}>{supplier.productCount}</Link> },
    {
      key: "actions",
      header: <span className="visuallyHidden">Actions</span>,
      align: "end",
      render: (supplier) => (
        <span className={styles.rowActions}>
          <Button size="small" variant="ghost" onClick={() => onEdit(supplier)}>Edit</Button>
          <Button size="small" variant="ghost" isBusy={removingSupplierId === supplier.id} onClick={() => void removeSupplier(supplier)}>Remove</Button>
        </span>
      ),
    },
  ];

  return (
    <Panel padded={false}>
      <div className={styles.toolbar}>
        <FilterBar>
          <SearchInput label="Search suppliers" placeholder="Name, contact or phone" value={searchText} onValueChange={setSearchText} />
        </FilterBar>
      </div>
      <DataTable
        caption="Suppliers"
        columns={columns}
        rows={table.visibleRows}
        readRowKey={(supplier) => supplier.id}
        isLoading={suppliersQuery.isLoading}
        errorMessage={suppliersQuery.errorMessage}
        onRetry={suppliersQuery.reload}
        sortState={table.sortState}
        onSortChange={table.setSortState}
        emptyState={<EmptyState iconName="buildingStore20" title="No suppliers yet" description="Add the markets and wholesalers you restock from." />}
        footer={<TablePagination pageIndex={table.pageIndex} pageCount={table.pageCount} totalCount={table.totalCount} pageSize={table.pageSize} onPageChange={table.setPageIndex} itemLabel="suppliers" />}
      />
    </Panel>
  );
}

export function SuppliersView() {
  const { hasFeature } = usePlanFeatures();
  const [editingSupplier, setEditingSupplier] = useState<Supplier | "new" | null>(null);
  const [reloadSignal, setReloadSignal] = useState(0);
  return (
    <PageStack>
      <PageHeader title="Suppliers" description="The wholesalers and markets you buy stock from, with lead times and payment terms." actions={hasFeature("advanced_inventory") ? <Button variant="primary" iconName="plus16" onClick={() => setEditingSupplier("new")}>New supplier</Button> : null} />
      <InventoryTabs />
      <PlanGate feature="advanced_inventory" description="Keep supplier contacts, lead times and payment terms, link them to products and get reorder suggestions.">
        <SuppliersTable key={reloadSignal} onEdit={setEditingSupplier} />
      </PlanGate>
      {editingSupplier ? <SupplierFormDialog key={editingSupplier === "new" ? "new" : editingSupplier.id} supplier={editingSupplier === "new" ? null : editingSupplier} onClose={() => setEditingSupplier(null)} onSaved={() => { setEditingSupplier(null); setReloadSignal((signal) => signal + 1); }} /> : null}
    </PageStack>
  );
}
