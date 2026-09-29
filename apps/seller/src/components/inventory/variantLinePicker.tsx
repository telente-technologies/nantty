"use client";

import { useState } from "react";

import { SearchInput } from "@/components/ui/filterControls";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { Product, ProductVariant } from "@/types/catalog.type";
import type { CursorPage } from "@/types/pagination.type";

import styles from "./inventoryDialogs.module.css";

export interface PickedVariant {
  readonly variant: ProductVariant;
  readonly productName: string;
}

export function VariantLinePicker({ locationId, excludedVariantIds, onPick }: { readonly locationId: string; readonly excludedVariantIds: ReadonlySet<string>; readonly onPick: (picked: PickedVariant) => void }) {
  const [searchText, setSearchText] = useState("");
  const resultsQuery = useSellerQuery<CursorPage<Product>>(searchText.trim().length >= 2 ? "/seller/products" : null, { q: searchText.trim(), limit: 8 });
  const matchingVariants = (resultsQuery.data?.data ?? []).flatMap((product) => product.variants.map((variant) => ({ variant, productName: product.name }))).filter(({ variant }) => !excludedVariantIds.has(variant.id)).slice(0, 12);
  return (
    <div className={styles.picker}>
      <SearchInput label="Find an item to add" placeholder="Type 2+ letters of a name, SKU or barcode" value={searchText} onValueChange={setSearchText} />
      {searchText.trim().length >= 2 ? (
        <ul className={styles.pickerResults} aria-label="Matching items">
          {resultsQuery.isLoading ? <li className={styles.pickerEmpty}>Searching…</li> : null}
          {!resultsQuery.isLoading && matchingVariants.length === 0 ? <li className={styles.pickerEmpty}>No items match.</li> : null}
          {matchingVariants.map(({ variant, productName }) => (
            <li key={variant.id}>
              <button type="button" className={styles.pickerOption} onClick={() => { onPick({ variant, productName }); setSearchText(""); }}>
                <span>
                  {productName} {variant.title !== "Default" ? `· ${variant.title}` : ""}
                  <small>{variant.sku}</small>
                </span>
                <span>{variant.stock.find((level) => level.locationId === locationId)?.onHand ?? 0} here</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
