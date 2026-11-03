import { calculateAverageProductMarginBasisPoints, calculateCompareAtDiscountBasisPoints, describeProductPublicationState, findLowestAndHighestVariantPrice, productVisibilityLabel, sumProductOnHand } from "@/components/catalog/productPresentation.util";
import type { DataTableColumn } from "@/components/ui/dataTable";
import { StatusBadge } from "@/components/ui/statusBadge";
import type { Money } from "@/types/money.type";
import type { Product } from "@/types/catalog.type";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

import styles from "./productListView.module.css";

interface ProductListColumnOptions {
  readonly canManage: boolean;
  readonly products: readonly Product[];
  readonly selectedProductIds: ReadonlySet<string>;
  readonly onSelectionChange: (selectedProductIds: ReadonlySet<string>) => void;
  readonly formatMoney: (money: Money | null | undefined) => string;
  readonly selectedLocationId: string | null;
}

function renderProductPriceCell(product: Product, formatMoney: ProductListColumnOptions["formatMoney"]) {
  const { lowest, highest } = findLowestAndHighestVariantPrice(product);
  const discounts = product.variants.map(calculateCompareAtDiscountBasisPoints).filter((discount): discount is number => discount !== null);
  const priceText = lowest && highest && lowest.amountMinor !== highest.amountMinor ? `${formatMoney(lowest)} – ${formatMoney(highest)}` : formatMoney(lowest);
  return (
    <span className={styles.priceCell}>
      {priceText}
      {discounts.length > 0 ? <span className={styles.discountTag}>−{formatBasisPointsAsPercent(Math.max(...discounts))}</span> : null}
    </span>
  );
}

export function buildProductListColumns({ canManage, products, selectedProductIds, onSelectionChange, formatMoney, selectedLocationId }: ProductListColumnOptions): DataTableColumn<Product>[] {
  const areAllVisibleSelected = products.length > 0 && products.every((product) => selectedProductIds.has(product.id));
  const toggleProductSelection = (productId: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(productId)) next.delete(productId);
    else next.add(productId);
    onSelectionChange(next);
  };
  const selectionColumn: DataTableColumn<Product> = {
    key: "select",
    width: "36px",
    header: <input type="checkbox" aria-label="Select all products on this page" checked={areAllVisibleSelected} onChange={() => onSelectionChange(areAllVisibleSelected ? new Set() : new Set(products.map((product) => product.id)))} />,
    render: (product) => <input type="checkbox" aria-label={`Select ${product.name}`} checked={selectedProductIds.has(product.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleProductSelection(product.id)} />,
  };
  const productColumns: DataTableColumn<Product>[] = [
    {
      key: "product",
      header: "Product",
      sortKey: "name",
      render: (product) => (
        <div className={styles.productCell}>
          {product.images[0] ? <img src={product.images[0].url} alt="" className={styles.thumbnail} loading="lazy" /> : <span className={styles.thumbnailPlaceholder} aria-hidden="true">{product.name.slice(0, 2).toUpperCase()}</span>}
          <span>
            <span className={styles.productName}>{product.name}</span>
            <span className={styles.productMeta}>{product.variants.length === 1 ? product.variants[0]?.sku : `${product.variants.length} variants`} · {product.categoryName ?? "No category"}{product.brand ? ` · ${product.brand.name}` : ""}</span>
          </span>
        </div>
      ),
    },
    { key: "price", header: "Price", align: "end", sortKey: "price", render: (product) => renderProductPriceCell(product, formatMoney) },
    {
      key: "stock",
      header: selectedLocationId ? "Stock here" : "Stock",
      align: "end",
      sortKey: "stock",
      render: (product) => {
        if (!product.trackInventory) return <span className={styles.productMeta}>Not tracked</span>;
        const onHand = sumProductOnHand(product, selectedLocationId);
        const isLow = product.variants.some((variant) => variant.stock.filter((level) => !selectedLocationId || level.locationId === selectedLocationId).reduce((sum, level) => sum + level.onHand - level.reserved, 0) <= variant.lowStockThreshold);
        return <span className={onHand <= 0 ? styles.outOfStock : isLow ? styles.lowStock : undefined}>{onHand}</span>;
      },
    },
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
    { key: "marketplace", header: "Marketplace", hideBelowTablet: true, render: (product) => (product.publishedOnline ? <StatusBadge tone="info">{productVisibilityLabel[product.visibility]}</StatusBadge> : <StatusBadge>Not listed</StatusBadge>) },
    {
      key: "status",
      header: "Status",
      sortKey: "updated",
      render: (product) => {
        const state = describeProductPublicationState(product);
        return <StatusBadge tone={state.tone}>{state.label}</StatusBadge>;
      },
    },
  ];
  return canManage ? [selectionColumn, ...productColumns] : productColumns;
}
