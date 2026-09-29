"use client";

import { useEffect, useState } from "react";

import { IconButton } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/filterControls";
import { CheckboxField } from "@/components/ui/formFields";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Product, ProductCategory } from "@/types/catalog.type";
import type { CursorPage } from "@/types/pagination.type";

import styles from "./promotions.module.css";

export interface PromotionScopeValue {
  readonly kind: "all" | "products" | "categories";
  readonly ids: string[];
}

function readItemsFromListResponse<Item>(response: CursorPage<Item> | Item[] | null | undefined): Item[] {
  if (!response) return [];
  return Array.isArray(response) ? response : response.data;
}

export function PromotionScopePicker({ value, onValueChange, errorMessage }: { readonly value: PromotionScopeValue; readonly onValueChange: (value: PromotionScopeValue) => void; readonly errorMessage?: string }) {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [productSearchText, setProductSearchText] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [knownProductNames, setKnownProductNames] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (value.kind !== "categories" || categories.length > 0) return;
    sendSellerApiRequest<CursorPage<ProductCategory> | ProductCategory[]>("/seller/categories")
      .then((response) => setCategories(readItemsFromListResponse(response)))
      .catch((error: unknown) => setLoadError(`Categories could not be loaded: ${readErrorMessageForDisplay(error)}`));
  }, [value.kind, categories.length]);

  useEffect(() => {
    if (value.kind !== "products") return;
    const abortController = new AbortController();
    sendSellerApiRequest<CursorPage<Product> | Product[]>("/seller/products", { query: { q: productSearchText, limit: 10, status: "active" }, signal: abortController.signal })
      .then((response) => {
        const products = readItemsFromListResponse(response);
        setProductResults(products);
        setKnownProductNames((current) => ({ ...current, ...Object.fromEntries(products.map((product) => [product.id, product.name])) }));
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(`Products could not be loaded: ${readErrorMessageForDisplay(error)}`);
      });
    return () => abortController.abort();
  }, [value.kind, productSearchText]);

  function toggleIdentifier(identifier: string, isChosen: boolean) {
    const nextIds = isChosen ? [...new Set([...value.ids, identifier])] : value.ids.filter((existingId) => existingId !== identifier);
    onValueChange({ ...value, ids: nextIds });
  }

  return (
    <div className={styles.stack}>
      <SegmentedControl
        label="Applies to"
        value={value.kind}
        onValueChange={(kind) => onValueChange({ kind, ids: [] })}
        options={[{ value: "all", label: "Everything" }, { value: "products", label: "Chosen products" }, { value: "categories", label: "Categories" }]}
      />
      {loadError ? <Callout tone="caution">{loadError}</Callout> : null}
      {value.kind === "categories" ? (
        <div className={styles.row}>
          {categories.map((category) => (
            <CheckboxField key={category.id} label={category.name} checked={value.ids.includes(category.id)} onCheckedChange={(isChosen) => toggleIdentifier(category.id, isChosen)} />
          ))}
        </div>
      ) : null}
      {value.kind === "products" ? (
        <>
          {value.ids.length > 0 ? (
            <div className={styles.chosenList} aria-label="Chosen products">
              {value.ids.map((productId) => (
                <span key={productId} className={styles.chosenChip}>
                  {knownProductNames[productId] ?? productId}
                  <IconButton iconName="cancel20" label={`Remove ${knownProductNames[productId] ?? productId}`} size="small" onClick={() => toggleIdentifier(productId, false)} />
                </span>
              ))}
            </div>
          ) : null}
          <SearchInput label="Search products" placeholder="Search products to add" value={productSearchText} onValueChange={setProductSearchText} />
          <div className={styles.pickerResults}>
            {productResults.map((product) => (
              <div key={product.id} className={styles.pickerRow}>
                <CheckboxField label={product.name} checked={value.ids.includes(product.id)} onCheckedChange={(isChosen) => toggleIdentifier(product.id, isChosen)} />
                <span className={styles.muted}>{product.categoryName ?? ""}</span>
              </div>
            ))}
            {productResults.length === 0 && !loadError ? <p className={styles.pickerRow}>No products match.</p> : null}
          </div>
        </>
      ) : null}
      {errorMessage ? <p className={styles.fieldError} role="alert">{errorMessage}</p> : null}
    </div>
  );
}
