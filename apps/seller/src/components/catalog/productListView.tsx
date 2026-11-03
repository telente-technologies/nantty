"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { FeaturePlanBadge } from "@/components/billing/planGate";
import { ProductBulkActionBar } from "@/components/catalog/productBulkActionBar";
import { buildProductListColumns } from "@/components/catalog/productListColumns";
import { defaultProductListFilters, ProductListFilters, type ProductListFilterValues } from "@/components/catalog/productListFilters";
import { ProductsSectionTabs } from "@/components/catalog/productsSectionTabs";
import { ProductUsageMeter } from "@/components/catalog/productUsageMeter";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type TableSortState } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { useCursorPagedList } from "@/hooks/useCursorPagedList.hook";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { Product } from "@/types/catalog.type";
import type { ProductUsageSummary } from "@/types/productRequests.type";

import styles from "./productListView.module.css";

const sortParameterBySortState: Record<string, Record<TableSortState["direction"], string>> = {
  name: { ascending: "name", descending: "name_desc" },
  price: { ascending: "price_asc", descending: "price_desc" },
  stock: { ascending: "stock", descending: "stock_desc" },
  updated: { ascending: "updated_asc", descending: "updated" },
};

function convertSortParameterToSortState(sortParameter: string): TableSortState | null {
  for (const [key, byDirection] of Object.entries(sortParameterBySortState)) {
    if (byDirection.ascending === sortParameter) return { key, direction: "ascending" };
    if (byDirection.descending === sortParameter) return { key, direction: "descending" };
  }
  return null;
}

interface ProductListViewProps {
  readonly initialCategoryId?: string;
  readonly initialStatus?: string;
  readonly initialStock?: string;
  readonly initialSupplierId?: string;
}

export function ProductListView({ initialCategoryId = "", initialStatus = "", initialStock = "", initialSupplierId = "" }: ProductListViewProps) {
  const router = useRouter();
  const { can } = useSellerSession();
  const canManageProducts = can("products:manage");
  const { formatMoney } = useMoneyFormatter();
  const { selectedLocationId } = useStoreContext();
  const [filters, setFilters] = useState<ProductListFilterValues>({ ...defaultProductListFilters, categoryId: initialCategoryId, status: initialStatus, stock: initialStock });
  const [selectedProductIds, setSelectedProductIds] = useState<ReadonlySet<string>>(new Set());
  const usageQuery = useSellerQuery<ProductUsageSummary>("/seller/products/usage");
  const productList = useCursorPagedList<Product>("/seller/products", {
    q: filters.searchText, categoryId: filters.categoryId, status: filters.status, online: filters.online, visibility: filters.visibility, stock: filters.stock, sort: filters.sort, supplierId: initialSupplierId || undefined, locationId: selectedLocationId, limit: 25,
  });
  const visibleProducts = useMemo(() => productList.items ?? [], [productList.items]);
  const columns = buildProductListColumns({ canManage: canManageProducts, products: visibleProducts, selectedProductIds, onSelectionChange: setSelectedProductIds, formatMoney, selectedLocationId });

  function refreshAfterBulkChange() {
    setSelectedProductIds(new Set());
    productList.reload();
    usageQuery.reload();
  }

  return (
    <PageStack>
      <PageHeader
        title="Products"
        description="Everything you sell on Nantty. Listed products show in the app; drafts and scheduled products wait here until you publish them."
        actions={
          <span className={styles.headerActions}>
            {canManageProducts ? <ButtonLink href="/products/import" iconName="export24">Import & export</ButtonLink> : null}
            <FeaturePlanBadge feature="bulk_tools" />
            {canManageProducts ? <ButtonLink href="/products/new" variant="primary" iconName="plus16">New product</ButtonLink> : null}
          </span>
        }
      />
      <ProductsSectionTabs />
      <ProductUsageMeter usageQuery={usageQuery} />
      <Panel padded={false}>
        <div className={styles.toolbar}>
          <ProductListFilters value={filters} onValueChange={(next) => { setFilters(next); setSelectedProductIds(new Set()); }} />
          {canManageProducts && selectedProductIds.size > 0 ? <ProductBulkActionBar selectedProductIds={[...selectedProductIds]} onFinished={refreshAfterBulkChange} /> : null}
        </div>
        <DataTable
          caption="Products"
          columns={columns}
          rows={productList.items}
          readRowKey={(product) => product.id}
          isLoading={productList.isLoading}
          errorMessage={productList.errorMessage}
          onRetry={productList.reload}
          sortState={convertSortParameterToSortState(filters.sort)}
          onSortChange={(sortState) => setFilters((current) => ({ ...current, sort: sortParameterBySortState[sortState.key]?.[sortState.direction] ?? "updated" }))}
          onRowActivate={canManageProducts ? (product) => router.push(`/products/${product.id}`) : undefined}
          hasMore={productList.hasMore}
          onLoadMore={productList.loadMore}
          isLoadingMore={productList.isLoadingMore}
          emptyState={<EmptyState iconName="tag24" title="No products match" description="Change the filters, or add your first product." action={canManageProducts ? <ButtonLink href="/products/new" variant="primary">New product</ButtonLink> : null} />}
        />
      </Panel>
    </PageStack>
  );
}
