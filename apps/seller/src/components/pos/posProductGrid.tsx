"use client";

import { useMemo, useState, type RefObject } from "react";

import { IconButton } from "@/components/ui/button";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { Product, ProductCategory } from "@/types/catalog.type";
import { buildProductInitials, filterProductsForRegisterSearch, readTotalAvailableStockForProductAtLocation } from "@/utils/posCatalog.util";

import styles from "./posProductGrid.module.css";

interface PosProductGridProps {
  readonly products: Product[];
  readonly categories: ProductCategory[];
  readonly locationId: string | null;
  readonly searchInputRef: RefObject<HTMLInputElement | null>;
  readonly onProductChosen: (product: Product) => void;
  readonly onCodeEntered: (code: string) => boolean;
  readonly onOpenCameraScanner: (() => void) | null;
}

export function PosProductGrid({ products, categories, locationId, searchInputRef, onProductChosen, onCodeEntered, onOpenCameraScanner }: PosProductGridProps) {
  const { formatMoney } = useMoneyFormatter();
  const [searchText, setSearchText] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const visibleProducts = useMemo(() => filterProductsForRegisterSearch(products, searchText, categoryId), [products, searchText, categoryId]);

  return (
    <section className={styles.catalog} aria-label="Products">
      <div className={styles.searchRow}>
        <label className={styles.search}>
          <ZudoIcon name="magnifyingGlass20" size={18} />
          <span className="visuallyHidden">Search products, or scan or type a barcode or SKU</span>
          <input
            ref={searchInputRef}
            data-scan-target="true"
            type="search"
            value={searchText}
            maxLength={80}
            autoComplete="off"
            placeholder="Search, scan or type a code (F2)"
            className={styles.searchInput}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchText.trim()) {
                event.preventDefault();
                if (onCodeEntered(searchText)) setSearchText("");
                else if (visibleProducts.length === 1 && visibleProducts[0]) {
                  onProductChosen(visibleProducts[0]);
                  setSearchText("");
                }
              } else if (event.key === "Escape") {
                setSearchText("");
              }
            }}
          />
        </label>
        {onOpenCameraScanner ? <IconButton iconName="camera24" label="Scan with the camera" variant="secondary" size="large" onClick={onOpenCameraScanner} /> : null}
      </div>
      <div className={styles.categories} role="group" aria-label="Filter by category">
        <button type="button" className={styles.chip} aria-pressed={categoryId === null} onClick={() => setCategoryId(null)}>
          All
        </button>
        {categories.map((category) => (
          <button key={category.id} type="button" className={styles.chip} aria-pressed={categoryId === category.id} onClick={() => setCategoryId(category.id)}>
            {category.name}
          </button>
        ))}
      </div>
      <ul className={styles.grid}>
        {visibleProducts.map((product) => {
          const available = readTotalAvailableStockForProductAtLocation(product, locationId);
          const firstVariant = product.variants[0];
          if (!firstVariant) return null;
          const lowestPrice = product.variants.reduce((lowest, variant) => (variant.price.amountMinor < lowest.amountMinor ? variant.price : lowest), firstVariant.price);
          return (
            <li key={product.id}>
              <button type="button" className={styles.tile} onClick={() => onProductChosen(product)}>
                <span className={styles.imageBox}>
                  {product.images[0] ? <img src={product.images[0].url} alt="" loading="lazy" className={styles.image} /> : <span className={styles.initials} aria-hidden="true">{buildProductInitials(product.name)}</span>}
                </span>
                <span className={styles.name}>{product.name}</span>
                <span className={styles.meta}>
                  <span className={styles.price}>
                    {product.variants.length > 1 ? "from " : ""}
                    {formatMoney(lowestPrice)}
                  </span>
                  <span className={available <= 0 ? styles.outOfStock : available <= 5 ? styles.lowStock : styles.inStock}>{available <= 0 ? "Out" : `${available} left`}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {visibleProducts.length === 0 ? <p className={styles.empty}>No products match “{searchText}”. Press Enter to look it up as a barcode.</p> : null}
    </section>
  );
}
