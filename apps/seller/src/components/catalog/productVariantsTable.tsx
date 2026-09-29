"use client";

import Link from "next/link";
import { useState } from "react";

import { describeVariantDraftTitle, type OptionDraft, type VariantDraft } from "@/components/catalog/productEditorDraft.util";
import { Button, IconButton } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import { convertMajorInputToMinorUnits, formatBasisPointsAsPercent } from "@/utils/money.util";
import { calculateMarginBasisPoints } from "@/utils/productValidation.util";

import styles from "./productEditor.module.css";

interface ProductVariantsTableProps {
  readonly variants: VariantDraft[];
  readonly options: OptionDraft[];
  readonly fieldErrors: Record<string, string>;
  readonly isNewProduct: boolean;
  readonly onVariantChange: (variantKey: string, patch: Partial<VariantDraft>) => void;
}

function sanitiseMoneyText(text: string): string {
  return text.replace(/[^\d.,]/g, "");
}

export function ProductVariantsTable({ variants, options, fieldErrors, isNewProduct, onVariantChange }: ProductVariantsTableProps) {
  const { settings, locations } = useStoreContext();
  const { showToast } = useToast();
  const [isGeneratingBarcodes, setIsGeneratingBarcodes] = useState(false);
  const currency = settings?.currency ?? null;
  const activeLocations = locations.filter((location) => location.active);

  async function generateBarcodesForVariants(targetVariants: VariantDraft[]) {
    if (targetVariants.length === 0) return;
    setIsGeneratingBarcodes(true);
    try {
      const result = await sendSellerApiRequest<{ barcodes: string[] }>("/seller/products/barcodes", { method: "POST", body: { count: targetVariants.length } });
      targetVariants.forEach((variant, index) => onVariantChange(variant.key, { barcode: result.barcodes[index] ?? "" }));
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsGeneratingBarcodes(false);
    }
  }

  function describeMargin(variant: VariantDraft): string {
    if (!currency) return "—";
    const margin = calculateMarginBasisPoints(convertMajorInputToMinorUnits(variant.priceText, currency), variant.costText ? convertMajorInputToMinorUnits(variant.costText, currency) : null);
    return margin === null ? "—" : formatBasisPointsAsPercent(margin);
  }

  const variantsWithoutBarcode = variants.filter((variant) => variant.barcode.trim() === "");
  const invalid = (index: number, field: string) => (fieldErrors[`variants.${index}.${field}`] ? true : undefined);

  return (
    <Panel
      title={`Variants (${variants.length})`}
      description={`Prices are in ${currency ?? "your store currency"}${settings?.pricesIncludeTax ? ", including tax" : ", before tax"}.`}
      actions={variantsWithoutBarcode.length > 0 ? <Button size="small" iconName="tag24" isBusy={isGeneratingBarcodes} onClick={() => void generateBarcodesForVariants(variantsWithoutBarcode)}>Generate {variantsWithoutBarcode.length} barcode{variantsWithoutBarcode.length === 1 ? "" : "s"}</Button> : null}
      padded={false}
    >
      <div className={styles.variantTableWrapper}>
        <table className={styles.variantTable}>
          <caption className="visuallyHidden">Variants</caption>
          <thead>
            <tr>
              <th scope="col">Variant</th>
              <th scope="col">SKU</th>
              <th scope="col">Barcode</th>
              <th scope="col">Price</th>
              <th scope="col">Compare-at</th>
              <th scope="col">Cost</th>
              <th scope="col">Margin</th>
              <th scope="col">Low-stock alert</th>
              <th scope="col">{isNewProduct ? "Opening stock" : "Stock"}</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => {
              const title = describeVariantDraftTitle(variant, options);
              return (
                <tr key={variant.key}>
                  <td className={styles.variantTitle}>{title}</td>
                  <td><input className={styles.cellInput} aria-label={`${title} SKU`} value={variant.sku} maxLength={64} aria-invalid={invalid(index, "sku")} onChange={(event) => onVariantChange(variant.key, { sku: event.target.value })} /></td>
                  <td>
                    <div className={styles.barcodeCell}>
                      <input className={styles.cellInput} aria-label={`${title} barcode`} inputMode="numeric" value={variant.barcode} maxLength={14} aria-invalid={invalid(index, "barcode")} onChange={(event) => onVariantChange(variant.key, { barcode: event.target.value.replace(/\D/g, "") })} />
                      {variant.barcode ? null : <IconButton iconName="refresh20" label={`Generate barcode for ${title}`} size="small" onClick={() => void generateBarcodesForVariants([variant])} disabled={isGeneratingBarcodes} />}
                    </div>
                  </td>
                  <td><input className={styles.cellInput} aria-label={`${title} price`} inputMode="decimal" value={variant.priceText} aria-invalid={invalid(index, "priceMinor")} onChange={(event) => onVariantChange(variant.key, { priceText: sanitiseMoneyText(event.target.value) })} /></td>
                  <td><input className={styles.cellInput} aria-label={`${title} compare-at price`} inputMode="decimal" value={variant.compareAtText} aria-invalid={invalid(index, "compareAtPriceMinor")} onChange={(event) => onVariantChange(variant.key, { compareAtText: sanitiseMoneyText(event.target.value) })} /></td>
                  <td><input className={styles.cellInput} aria-label={`${title} cost price`} inputMode="decimal" value={variant.costText} aria-invalid={invalid(index, "costPriceMinor")} onChange={(event) => onVariantChange(variant.key, { costText: sanitiseMoneyText(event.target.value) })} /></td>
                  <td>{describeMargin(variant)}</td>
                  <td><input className={styles.cellInput} style={{ minWidth: 70 }} aria-label={`${title} low-stock alert`} inputMode="numeric" value={variant.lowStockThresholdText} aria-invalid={invalid(index, "lowStockThreshold")} onChange={(event) => onVariantChange(variant.key, { lowStockThresholdText: event.target.value.replace(/\D/g, "") })} /></td>
                  <td>
                    {isNewProduct || !variant.id ? (
                      <div className={styles.stockList}>
                        {activeLocations.map((location) => (
                          <label key={location.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input className={styles.cellInput} style={{ minWidth: 60, width: 70 }} inputMode="numeric" placeholder="0" aria-label={`${title} opening stock at ${location.name}`} value={variant.openingStockTextByLocationId[location.id] ?? ""} onChange={(event) => onVariantChange(variant.key, { openingStockTextByLocationId: { ...variant.openingStockTextByLocationId, [location.id]: event.target.value.replace(/\D/g, "") } })} />
                            <span>{location.name}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.stockList}>
                        {variant.stock.map((level) => (
                          <span key={level.locationId}>{locations.find((location) => location.id === level.locationId)?.name ?? level.locationId}: <strong>{level.onHand}</strong>{level.reserved > 0 ? ` (${level.reserved} reserved)` : ""}</span>
                        ))}
                        <Link href={`/inventory/adjustments?variantId=${encodeURIComponent(variant.id)}`}>Adjust stock</Link>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
