"use client";

import { FilterBar, SearchInput } from "@/components/ui/filterControls";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { ProductCategory } from "@/types/catalog.type";
import type { CursorPage } from "@/types/pagination.type";

import styles from "./productListFilters.module.css";

export interface ProductListFilterValues {
  readonly searchText: string;
  readonly categoryId: string;
  readonly status: string;
  readonly online: string;
  readonly visibility: string;
  readonly stock: string;
  readonly sort: string;
}

export const defaultProductListFilters: ProductListFilterValues = { searchText: "", categoryId: "", status: "", online: "", visibility: "", stock: "", sort: "updated" };

export function CompactSelect({ label, value, options, onChange }: { readonly label: string; readonly value: string; readonly options: readonly [string, string][]; readonly onChange: (value: string) => void }) {
  return (
    <label className={styles.compactSelect}>
      <span className="visuallyHidden">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

export function ProductListFilters({ value, onValueChange }: { readonly value: ProductListFilterValues; readonly onValueChange: (value: ProductListFilterValues) => void }) {
  const categoriesQuery = useSellerQuery<CursorPage<ProductCategory>>("/seller/categories");
  const update = (patch: Partial<ProductListFilterValues>) => onValueChange({ ...value, ...patch });
  return (
    <FilterBar>
      <SearchInput label="Search products" placeholder="Search name, SKU or barcode" value={value.searchText} onValueChange={(searchText) => update({ searchText })} />
      <CompactSelect label="Category" value={value.categoryId} onChange={(categoryId) => update({ categoryId })} options={[["", "All categories"], ...(categoriesQuery.data?.data ?? []).map((category): [string, string] => [category.id, category.name])]} />
      <CompactSelect label="Status" value={value.status} onChange={(status) => update({ status })} options={[["", "Active and drafts"], ["active", "Active"], ["draft", "Drafts"], ["scheduled", "Scheduled"], ["archived", "Archived"], ["all", "All statuses"]]} />
      <CompactSelect label="Marketplace" value={value.online} onChange={(online) => update({ online })} options={[["", "Listed or not"], ["true", "Listed on Nantty"], ["false", "Not listed"]]} />
      <CompactSelect label="Visibility" value={value.visibility} onChange={(visibility) => update({ visibility })} options={[["", "Any visibility"], ["public", "Everyone"], ["store_only", "Store page only"], ["link_only", "Link only"]]} />
      <CompactSelect label="Stock" value={value.stock} onChange={(stock) => update({ stock })} options={[["", "Any stock"], ["low", "Low stock"], ["out", "Out of stock"]]} />
    </FilterBar>
  );
}
