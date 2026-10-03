"use client";

import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { TablePagination } from "@/components/ui/tablePagination";
import { useClientTableState, type TableSortValueReader } from "@/hooks/useClientTableState.hook";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { AnalyticsProductPerformance } from "@/types/analytics.type";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

import styles from "./analytics.module.css";

const productSortValueReaders: Record<string, TableSortValueReader<AnalyticsProductPerformance>> = {
  name: (row) => row.name,
  unitsSold: (row) => row.unitsSold,
  revenue: (row) => row.revenue.amountMinor,
  productViews: (row) => row.productViews,
  conversion: (row) => row.conversionRateBasisPoints,
  stock: (row) => row.stockAvailable,
  lastSoldAt: (row) => row.lastSoldAt,
};

function ProductNameCell({ row }: { readonly row: AnalyticsProductPerformance }) {
  return (
    <span className={styles.productCell}>
      {row.imageUrl ? <img src={row.imageUrl} alt="" className={styles.thumbnail} loading="lazy" /> : <span className={styles.thumbnailFallback} aria-hidden="true">{row.name.slice(0, 1)}</span>}
      <span className={styles.productText}>
        <Link href={`/products/${row.productId}`}>{row.name}</Link>
        <span className={styles.muted}>{row.categoryName}</span>
      </span>
    </span>
  );
}

function ProductPerformanceTable({ caption, rows, emptyTitle, emphasis }: { readonly caption: string; readonly rows: readonly AnalyticsProductPerformance[]; readonly emptyTitle: string; readonly emphasis: "revenue" | "slow" }) {
  const { formatMoney } = useMoneyFormatter();
  const table = useClientTableState(rows, productSortValueReaders, { pageSize: 5, initialSort: emphasis === "revenue" ? { key: "revenue", direction: "descending" } : { key: "unitsSold", direction: "ascending" } });
  const columns: DataTableColumn<AnalyticsProductPerformance>[] = [
    { key: "name", header: "Product", sortKey: "name", render: (row) => <ProductNameCell row={row} /> },
    { key: "unitsSold", header: "Units", sortKey: "unitsSold", align: "end", render: (row) => row.unitsSold },
    { key: "revenue", header: "Revenue", sortKey: "revenue", align: "end", render: (row) => formatMoney(row.revenue) },
    { key: "productViews", header: "Views", sortKey: "productViews", align: "end", hideBelowTablet: true, render: (row) => row.productViews.toLocaleString("en-NG") },
    { key: "conversion", header: "Conversion", sortKey: "conversion", align: "end", hideBelowTablet: true, render: (row) => formatBasisPointsAsPercent(row.conversionRateBasisPoints) },
    emphasis === "slow"
      ? { key: "stock", header: "In stock", sortKey: "stock", align: "end", render: (row) => (row.stockAvailable === 0 ? <StatusBadge tone="error">Sold out</StatusBadge> : row.stockAvailable) }
      : { key: "lastSoldAt", header: "Last sold", sortKey: "lastSoldAt", hideBelowTablet: true, render: (row) => (row.lastSoldAt ? formatDateForDisplay(`${row.lastSoldAt}T12:00:00.000Z`) : "—") },
  ];
  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={table.visibleRows}
      readRowKey={(row) => row.productId}
      sortState={table.sortState}
      onSortChange={table.setSortState}
      emptyState={<EmptyState iconName="tag24" title={emptyTitle} />}
      footer={table.totalCount > table.pageSize ? <TablePagination pageIndex={table.pageIndex} pageCount={table.pageCount} totalCount={table.totalCount} pageSize={table.pageSize} onPageChange={table.setPageIndex} itemLabel="products" /> : undefined}
    />
  );
}

export function AnalyticsBestProductsPanel({ rows }: { readonly rows: readonly AnalyticsProductPerformance[] }) {
  return (
    <Panel title="Best sellers" description="Top products by revenue in this period" padded={false}>
      <ProductPerformanceTable caption="Best-selling products" rows={rows} emptyTitle="No sales in this period" emphasis="revenue" />
    </Panel>
  );
}

export function AnalyticsSlowProductsPanel({ rows }: { readonly rows: readonly AnalyticsProductPerformance[] }) {
  return (
    <Panel title="Slow movers" description="Active products that sold least — consider a discount, better photos or a restock decision" padded={false}>
      <ProductPerformanceTable caption="Slow-moving products" rows={rows} emptyTitle="Every product is selling" emphasis="slow" />
    </Panel>
  );
}
