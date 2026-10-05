"use client";

import { useState } from "react";

import { BarcodeSvg } from "@/components/catalog/barcodeSvg";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorCallout } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/filterControls";
import { SelectField, ToggleSwitch } from "@/components/ui/formFields";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { ProductsSectionTabs } from "@/components/catalog/productsSectionTabs";
import { useCursorPagedList } from "@/hooks/useCursorPagedList.hook";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { Product, ProductVariant } from "@/types/catalog.type";

import styles from "./barcodeLabels.module.css";

type LabelSize = "38x25" | "50x30" | "a4";

const pageRuleByLabelSize: Record<LabelSize, string> = {
  "38x25": "@page { size: 38mm 25mm; margin: 0; }",
  "50x30": "@page { size: 50mm 30mm; margin: 0; }",
  a4: "@page { size: A4; margin: 15mm 7mm; }",
};
const labelClassBySize: Record<LabelSize, string | undefined> = { "38x25": styles.size38x25, "50x30": styles.size50x30, a4: styles.sizeA4 };
const maximumCopiesPerVariant = 500;

interface ChosenLabel {
  readonly product: Product;
  readonly variant: ProductVariant;
  readonly copies: number;
}

export function BarcodeLabelsView() {
  const { formatMoney } = useMoneyFormatter();
  const [searchText, setSearchText] = useState("");
  const [labelSize, setLabelSize] = useState<LabelSize>("38x25");
  const [showPrice, setShowPrice] = useState(true);
  const [chosenLabels, setChosenLabels] = useState<Record<string, ChosenLabel>>({});
  const productList = useCursorPagedList<Product>("/seller/products", { q: searchText, status: "active", limit: 30, sort: "name" });

  function setCopiesForVariant(product: Product, variant: ProductVariant, copiesText: string) {
    const copies = Math.min(maximumCopiesPerVariant, Math.max(0, Math.floor(Number(copiesText.replace(/\D/g, "") || "0"))));
    setChosenLabels((current) => {
      const next = { ...current };
      if (copies === 0) delete next[variant.id];
      else next[variant.id] = { product, variant, copies };
      return next;
    });
  }

  const labelsToPrint = Object.values(chosenLabels).flatMap((chosen) => Array.from({ length: chosen.copies }, (_, copyIndex) => ({ ...chosen, key: `${chosen.variant.id}-${copyIndex}` })));

  return (
    <PageStack>
      <style>{`@media print { ${pageRuleByLabelSize[labelSize]} }`}</style>
      <div className="noPrint">
        <PageHeader
          eyebrow={<ButtonLink href="/products" variant="ghost" size="small" iconName="arrowLeft24">Products</ButtonLink>}
          title="Product labels"
          description="Print SKU and barcode labels for packaging and your stockroom, so picking and packing app orders is fast. EAN-13 barcodes print as EAN-13; anything else prints as Code 128."
          actions={<Button variant="primary" iconName="tag24" disabled={labelsToPrint.length === 0} onClick={() => window.print()}>Print {labelsToPrint.length} label{labelsToPrint.length === 1 ? "" : "s"}</Button>}
        />
        <ProductsSectionTabs />
      </div>
      <div className={styles.layout}>
        <div className="noPrint">
          <Panel title="Choose items">
            <SearchInput label="Search products" placeholder="Search name or SKU" value={searchText} onValueChange={setSearchText} />
            {productList.errorMessage ? <ErrorCallout message={productList.errorMessage} onRetry={productList.reload} /> : null}
            <div className={styles.variantList}>
              {(productList.items ?? []).flatMap((product) => product.variants.map((variant) => (
                <label key={variant.id} className={styles.variantRow}>
                  <span>
                    {product.name}
                    <small>{variant.title === "Default" ? variant.sku : `${variant.title} · ${variant.sku}`}</small>
                  </span>
                  <input className={styles.copiesInput} inputMode="numeric" placeholder="0" aria-label={`Copies of ${product.name} ${variant.title}`} value={chosenLabels[variant.id]?.copies ?? ""} onChange={(event) => setCopiesForVariant(product, variant, event.target.value)} />
                </label>
              )))}
              {productList.hasMore ? <Button size="small" onClick={productList.loadMore} isBusy={productList.isLoadingMore}>Load more</Button> : null}
            </div>
          </Panel>
          <div style={{ marginTop: 16 }}>
            <Panel title="Label format">
              <SelectField label="Label size" value={labelSize} onChange={(event) => setLabelSize(event.target.value as LabelSize)} options={[{ value: "38x25", label: "38 × 25 mm roll (thermal)" }, { value: "50x30", label: "50 × 30 mm roll (thermal)" }, { value: "a4", label: "A4 sheet, 21 labels (63.5 × 38.1 mm)" }]} />
              <ToggleSwitch label="Show price" checked={showPrice} onCheckedChange={setShowPrice} />
            </Panel>
          </div>
        </div>
        <section aria-label="Label preview">
          {labelsToPrint.length === 0 ? (
            <div className="noPrint"><EmptyState iconName="tag24" title="No labels yet" description="Enter how many copies you need next to each item." /></div>
          ) : (
            <div className={`${styles.sheet} ${labelSize === "a4" ? styles.sheetA4 : styles.rollLabels}`}>
              {labelsToPrint.map((label) => (
                <div key={label.key} className={`${styles.label} ${labelClassBySize[labelSize] ?? ""}`}>
                  <span className={styles.labelName}>{label.product.name}</span>
                  {label.variant.title !== "Default" ? <span className={styles.labelVariant}>{label.variant.title}</span> : null}
                  <BarcodeSvg className={styles.labelBars} barcode={label.variant.barcode} sku={label.variant.sku} />
                  <span className={styles.labelFooter}>
                    <span>{label.variant.barcode ?? label.variant.sku}</span>
                    {showPrice ? <span className={styles.labelPrice}>{formatMoney(label.variant.price)}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageStack>
  );
}
