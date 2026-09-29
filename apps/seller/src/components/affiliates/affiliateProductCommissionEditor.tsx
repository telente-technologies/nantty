"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { ProductCommissionRow } from "@/types/affiliate.type";
import { convertBasisPointsToPercentText, convertPercentTextToBasisPoints, maximumAffiliateCommissionPercent } from "@/utils/affiliateFormatting.util";

import styles from "./affiliateViews.module.css";

export function AffiliateProductCommissionEditor({ row, defaultCommissionBasisPoints, onSaved }: { readonly row: ProductCommissionRow; readonly defaultCommissionBasisPoints: number | null; readonly onSaved: () => void }) {
  const { showToast } = useToast();
  const [percentText, setPercentText] = useState(convertBasisPointsToPercentText(row.commissionBasisPoints));
  const [isExcluded, setIsExcluded] = useState(row.excluded);
  const [isSaving, setIsSaving] = useState(false);
  const parsedBasisPoints = percentText.trim() === "" ? null : convertPercentTextToBasisPoints(percentText);
  const isPercentInvalid = percentText.trim() !== "" && parsedBasisPoints === null;
  const hasChanges = parsedBasisPoints !== row.commissionBasisPoints || isExcluded !== row.excluded;
  const inputId = `commission-${row.productId}`;

  async function saveProductCommissionOverride() {
    if (isPercentInvalid) return;
    setIsSaving(true);
    try {
      await sendSellerApiRequest(`/seller/affiliates/product-commissions/${encodeURIComponent(row.productId)}`, { method: "PUT", body: { commissionBasisPoints: parsedBasisPoints, excluded: isExcluded } });
      showToast(isExcluded ? `${row.productName} is excluded from the program.` : `Commission for ${row.productName} saved.`);
      onSaved();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <span className={styles.inlineRow} style={{ justifyContent: "flex-end" }}>
      <label htmlFor={inputId} className="visuallyHidden">
        Commission percent for {row.productName}
      </label>
      <input
        id={inputId}
        className={styles.percentInput}
        inputMode="decimal"
        maxLength={5}
        placeholder={defaultCommissionBasisPoints === null ? "Default" : convertBasisPointsToPercentText(defaultCommissionBasisPoints)}
        value={percentText}
        disabled={isExcluded}
        aria-invalid={isPercentInvalid || undefined}
        title={isPercentInvalid ? `Use 0 to ${maximumAffiliateCommissionPercent}%` : "Leave empty to use your default"}
        onChange={(event) => setPercentText(event.target.value.replace(/[^\d.]/g, ""))}
      />
      <span aria-hidden="true">%</span>
      <label className={styles.inlineRow} style={{ gap: 4, fontSize: 13 }}>
        <input type="checkbox" checked={isExcluded} onChange={(event) => setIsExcluded(event.target.checked)} /> Exclude
      </label>
      <Button size="small" variant={hasChanges ? "primary" : "secondary"} disabled={!hasChanges || isPercentInvalid} isBusy={isSaving} onClick={() => void saveProductCommissionOverride()}>
        Save
      </Button>
    </span>
  );
}
