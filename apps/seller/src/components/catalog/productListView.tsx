"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ProductBulkActionBar } from "@/components/catalog/productBulkActionBar";
import { ProductListFilters, type ProductListFilterValues } from "@/components/catalog/productListFilters";
import { calculateAverageProductMarginBasisPoints, findLowestAndHighestVariantPrice, productStatusLabel, productStatusTone, sumProductOnHand } from "@/components/catalog/productPresentation.util";
import { Button, ButtonLink } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useCursorPagedList } from "@/hooks/useCursorPagedList.hook";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Product } from "@/types/catalog.type";
import { triggerBrowserDownload } from "@/utils/csvFile.util";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

import styles from "./productListView.module.css";

const defaultFilters: ProductListFilterValues = { searchText: "", categoryId: "", status: "", online: "", stock: "", sort: "updated" };

export function ProductListView() {
  const router = useRouter();
  const { showToast } = useToast();
  const { formatMoney } = useMoneyFormatter();
  const { selectedLocationId, locations } = useStoreContext();
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedProductIds, setSelectedProductIds] = useState<ReadonlySet<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const productList = useCursorPagedList<Product>("/seller/products", {
    q: filters.searchText, categoryId: filters.categoryId, status: filters.status, online: filters.online, stock: filters.stock, sort: filters.sort, locationId: selectedLocationId, limit: 25,
  });
  const selectedLocationName = locations.find((location) => location.id === selectedLocationId)?.name ?? "this location";

  function toggleProductSelection(productId: string) {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  async function downloadProductsAsCsv() {
    setIsExporting(true);
    try {
      const csvBlob = await sendSellerApiRequest<Blob>("/seller/products/export", { query: { locationId: selectedLocationId }, expect: "blob" });
      triggerBrowserDownload(`products-${new Date().toISOString().slice(0, 10)}.csv`, csvBlob);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsExporting(false);
    }
  }

  const visibleProducts = useMemo(() => productList.items ?? [], [productList.items]);
  const areAllVisibleSelected = visibleProducts.length > 0 && visibleProducts.every((product) => selectedProductIds.has(product.id));

  const columns: DataTableColumn<Product>[] = [
    {
      key: "select",
      width: "36px",
      header: <input type="checkbox" aria-label="Select all products on this page" checked={areAllVisibleSelected} onChange={() => setSelectedProductIds(areAllVisibleSelected ? new Set() : new Set(visibleProducts.map((product) => product.id)))} />,
      render: (product) => <input type="checkbox" aria-label={`Select ${product.name}`} checked={selectedProductIds.has(product.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleProductSelection(product.id)} />,
    },
    {
      key: "product",
      header: "Product",
      render: (product) => (
        <div className={styles.productCell}>
          {product.images[0] ? <img src={product.images[0].url} alt="" className={styles.thumbnail} loading="lazy" /> : <span className={styles.thumbnailPlaceholder} aria-hidden="true">{product.name.slice(0, 2).toUpperCase()}</span>}
          <span>
            <span className={styles.productName}>{product.name}</span>
            <span className={styles.productMeta}>{product.variants.length === 1 ? product.variants[0]?.sku : `${product.variants.length} variants`} · {product.categoryName ?? "No category"}</span>
          </span>
        </div>
      ),
    },
    {
      key: "price",
      header: "Price",
      align: "end",
      render: (product) => {
        const { lowest, highest } = findLowestAndHighestVariantPrice(product);
        return lowest && highest && lowest.amountMinor !== highest.amountMinor ? `${formatMoney(lowest)} – ${formatMoney(highest)}` : formatMoney(lowest);
      },
    },
    {
      key: "stockHere",
      header: "Stock here",
      align: "end",
      render: (product) => {
        const onHandHere = sumProductOnHand(product, selectedLocationId);
        const isLow = product.variants.some((variant) => variant.stock.filter((level) => level.locationId === selectedLocationId).reduce((sum, level) => sum + level.onHand, 0) <= variant.lowStockThreshold);
        return <span className={isLow ? styles.lowStock : undefined}>{onHandHere}</span>;
      },
    },
    { key: "stockAll", header: "All locations", align: "end", hideBelowTablet: true, render: (product) => sumProductOnHand(product, null) },
    {
      key: "margin",
      header: "Margin",
      align: "end",
      hideBelowTablet: true,
      render: (product) => {
        const margin = calculateAverageProductMarginBasisPoints(product);
        return margin === null ? "—" : formatBasisPointsAsPercent(margin);
      },
    },
    { key: "online", header: "Marketplace", render: (product) => (product.publishedOnline ? <StatusBadge tone="info">Published</StatusBadge> : <StatusBadge>In store only</StatusBadge>) },
    { key: "status", header: "Status", hideBelowTablet: true, render: (product) => <StatusBadge tone={productStatusTone[product.status]}>{productStatusLabel[product.status]}</StatusBadge> },
  ];

  return (
    <PageStack>
      <PageHeader
        title="Products"
        description="Everything you sell in store and on the Zudomart marketplace."
        actions={
          <>
            <ButtonLink href="/products/import" iconName="export24">Import</ButtonLink>
            <Button iconName="boxArrowDown24" onClick={() => void downloadProductsAsCsv()} isBusy={isExporting}>Export CSV</Button>
            <ButtonLink href="/products/labels" iconName="tag24">Print labels</ButtonLink>
            <ButtonLink href="/products/new" variant="primary" iconName="plus16">New product</ButtonLink>
          </>
        }
      />
      <Callout tone="info">Online and in-store sales draw from the same stock. “Stock here” counts {selectedLocationName}; marketplace orders ship from any location with stock.</Callout>
      <Panel padded={false}>
        <div className={styles.toolbar}>
          <ProductListFilters value={filters} onValueChange={(next) => { setFilters(next); setSelectedProductIds(new Set()); }} />
          {selectedProductIds.size > 0 ? <ProductBulkActionBar selectedProductIds={[...selectedProductIds]} onFinished={() => { setSelectedProductIds(new Set()); productList.reload(); }} /> : null}
        </div>
        {productList.errorMessage ? <div className={styles.errorRow}><Callout tone="error">{productList.errorMessage}</Callout></div> : null}
        <DataTable
          caption="Products"
          columns={columns}
          rows={productList.items}
          readRowKey={(product) => product.id}
          isLoading={productList.isLoading}
          onRowActivate={(product) => router.push(`/products/${product.id}`)}
          hasMore={productList.hasMore}
          onLoadMore={productList.loadMore}
          isLoadingMore={productList.isLoadingMore}
          emptyState={<EmptyState iconName="tag24" title="No products match" description="Change the filters, or add your first product." action={<ButtonLink href="/products/new" variant="primary">New product</ButtonLink>} />}
        />
      </Panel>
    </PageStack>
  );
}
