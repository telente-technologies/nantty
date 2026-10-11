"use client";

import { useEffect, useState } from "react";

import { VariantLinePicker, type PickedVariant } from "@/components/inventory/variantLinePicker";
import { Button, IconButton } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { SelectField, TextAreaField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { createIdempotencyKey, readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { StockAdjustmentReason } from "@/types/catalog.type";
import type { StockAdjustmentRequest } from "@/types/productRequests.type";

import styles from "./inventoryDialogs.module.css";

export const stockAdjustmentReasonLabels: Record<StockAdjustmentReason, string> = {
  received: "Received from supplier",
  count: "Stock count (set to counted amount)",
  damaged: "Damaged",
  theft: "Theft or loss",
  returned: "Returned by customer",
  expired: "Expired",
  other: "Other",
};

interface AdjustmentLineDraft extends PickedVariant {
  readonly quantityText: string;
}

function readOnHandHere(line: PickedVariant, locationId: string): number {
  return line.variant.stock.find((level) => level.locationId === locationId)?.onHand ?? 0;
}

export function NewStockAdjustmentDialog({ isOpen, initialLocationId, initialVariant, onClose, onSaved }: { readonly isOpen: boolean; readonly initialLocationId: string; readonly initialVariant: PickedVariant | null; readonly onClose: () => void; readonly onSaved: () => void }) {
  const { locations } = useStoreContext();
  const { showToast } = useToast();
  const [locationId, setLocationId] = useState(initialLocationId);
  const [reason, setReason] = useState<StockAdjustmentReason>("received");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<AdjustmentLineDraft[]>([]);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey("adjust"));

  useEffect(() => {
    if (!isOpen) return;
    setLocationId(initialLocationId);
    setReason("received");
    setNote("");
    setErrorMessages([]);
    setLines(initialVariant ? [{ ...initialVariant, quantityText: "" }] : []);
    setIdempotencyKey(createIdempotencyKey("adjust"));
  }, [isOpen, initialLocationId, initialVariant]);

  const isCount = reason === "count";
  const isRemoval = reason === "damaged" || reason === "theft" || reason === "expired";

  function calculateDelta(line: AdjustmentLineDraft): number | null {
    if (!/^-?\d{1,7}$/.test(line.quantityText.trim())) return null;
    const entered = Number(line.quantityText);
    if (isCount) return entered - readOnHandHere(line, locationId);
    return isRemoval ? -Math.abs(entered) : entered;
  }

  async function saveAdjustment() {
    const problems: string[] = [];
    if (lines.length === 0) problems.push("Add at least one item.");
    const requestLines = lines.map((line) => ({ variantId: line.variant.id, quantityDelta: calculateDelta(line) }));
    requestLines.forEach((line, index) => {
      if (line.quantityDelta === null) problems.push(`Line ${index + 1}: enter a whole number.`);
      else if (line.quantityDelta === 0) problems.push(`Line ${index + 1}: this does not change the stock.`);
      else if (isCount && Number(lines[index]?.quantityText) < 0) problems.push(`Line ${index + 1}: counted amount cannot be negative.`);
    });
    if ((reason === "other" || reason === "theft") && note.trim() === "") problems.push("Add a note explaining this change.");
    if (note.length > 500) problems.push("Notes must be 500 characters or fewer.");
    setErrorMessages(problems);
    if (problems.length > 0) return;
    const request: StockAdjustmentRequest = { locationId, reason, note: note.trim() || null, lines: requestLines.map((line) => ({ variantId: line.variantId, quantityDelta: line.quantityDelta ?? 0 })) };
    setIsSaving(true);
    try {
      await sendSellerApiRequest("/seller/inventory/adjustments", { method: "POST", body: request, idempotencyKey });
      showToast("Stock updated.");
      onSaved();
    } catch (error) {
      setErrorMessages([readErrorMessageForDisplay(error)]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalDialog intent="inventory"
      isOpen={isOpen}
      onClose={onClose}
      title="Adjust stock"
      description="Every change is logged with your name and reason."
      width="large"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => void saveAdjustment()} isBusy={isSaving}>Save adjustment</Button></>}
    >
      <div className={styles.form}>
        {errorMessages.length > 0 ? <Callout tone="error">{errorMessages.map((message) => <p key={message}>{message}</p>)}</Callout> : null}
        <div className={styles.twoColumns}>
          <SelectField label="Location" value={locationId} onChange={(event) => setLocationId(event.target.value)} options={locations.map((location) => ({ value: location.id, label: location.name }))} />
          <SelectField label="Reason" value={reason} onChange={(event) => setReason(event.target.value as StockAdjustmentReason)} options={Object.entries(stockAdjustmentReasonLabels).map(([value, label]) => ({ value, label }))} />
        </div>
        <VariantLinePicker locationId={locationId} excludedVariantIds={new Set(lines.map((line) => line.variant.id))} onPick={(picked) => setLines((current) => [...current, { ...picked, quantityText: "" }])} />
        {lines.length > 0 ? (
          <table className={styles.lineTable}>
            <thead><tr><th>Item</th><th>In stock here</th><th>{isCount ? "Counted" : isRemoval ? "Remove" : "Add (use - to remove)"}</th><th>Change</th><th><span className="visuallyHidden">Remove line</span></th></tr></thead>
            <tbody>
              {lines.map((line) => {
                const delta = calculateDelta(line);
                return (
                  <tr key={line.variant.id}>
                    <td>{line.productName}{line.variant.title !== "Default" ? ` · ${line.variant.title}` : ""}</td>
                    <td>{readOnHandHere(line, locationId)}</td>
                    <td><input className={styles.quantityInput} inputMode="numeric" aria-label={`Quantity for ${line.productName} ${line.variant.title}`} aria-invalid={line.quantityText !== "" && delta === null ? true : undefined} value={line.quantityText} onChange={(event) => setLines((current) => current.map((candidate) => (candidate.variant.id === line.variant.id ? { ...candidate, quantityText: event.target.value.replace(/[^\d-]/g, "") } : candidate)))} /></td>
                    <td className={delta !== null && delta < 0 ? styles.negative : styles.positive}>{delta === null ? "—" : delta > 0 ? `+${delta}` : delta}</td>
                    <td><IconButton iconName="trash24" size="small" label="Remove line" onClick={() => setLines((current) => current.filter((candidate) => candidate.variant.id !== line.variant.id))} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
        <TextAreaField label="Note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} hint={reason === "other" || reason === "theft" ? "Required for this reason." : "Optional, for example the supplier invoice number."} />
      </div>
    </ModalDialog>
  );
}
