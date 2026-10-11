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
import type { StockTransfer } from "@/types/catalog.type";
import type { StockTransferRequest } from "@/types/productRequests.type";

import styles from "./inventoryDialogs.module.css";

interface TransferLineDraft extends PickedVariant {
  readonly quantityText: string;
}

export function NewStockTransferDialog({ isOpen, onClose, onSaved }: { readonly isOpen: boolean; readonly onClose: () => void; readonly onSaved: (transfer: StockTransfer) => void }) {
  const { locations, selectedLocationId } = useStoreContext();
  const { showToast } = useToast();
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<TransferLineDraft[]>([]);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey("transfer"));

  useEffect(() => {
    if (!isOpen) return;
    const warehouse = locations.find((location) => location.kind === "warehouse");
    const source = warehouse?.id ?? locations[0]?.id ?? "";
    setFromLocationId(source);
    setToLocationId(locations.find((location) => location.id !== source && location.id === selectedLocationId)?.id ?? locations.find((location) => location.id !== source)?.id ?? "");
    setNote("");
    setLines([]);
    setErrorMessages([]);
    setIdempotencyKey(createIdempotencyKey("transfer"));
  }, [isOpen, locations, selectedLocationId]);

  const availableAtSource = (line: PickedVariant) => line.variant.stock.find((level) => level.locationId === fromLocationId)?.onHand ?? 0;

  async function sendTransfer() {
    const problems: string[] = [];
    if (!fromLocationId || !toLocationId) problems.push("Choose both locations.");
    if (fromLocationId === toLocationId) problems.push("Pick two different locations.");
    if (lines.length === 0) problems.push("Add at least one item.");
    lines.forEach((line, index) => {
      const quantity = Number(line.quantityText);
      if (!/^\d{1,7}$/.test(line.quantityText) || quantity <= 0) problems.push(`Line ${index + 1}: enter a quantity above zero.`);
      else if (quantity > availableAtSource(line)) problems.push(`Line ${index + 1}: only ${availableAtSource(line)} at the source location.`);
    });
    if (note.length > 500) problems.push("Notes must be 500 characters or fewer.");
    setErrorMessages(problems);
    if (problems.length > 0) return;
    const request: StockTransferRequest = { fromLocationId, toLocationId, note: note.trim() || null, lines: lines.map((line) => ({ variantId: line.variant.id, quantity: Number(line.quantityText) })) };
    setIsSaving(true);
    try {
      const transfer = await sendSellerApiRequest<StockTransfer>("/seller/inventory/transfers", { method: "POST", body: request, idempotencyKey });
      showToast(`${transfer.reference} is on its way.`);
      onSaved(transfer);
    } catch (error) {
      setErrorMessages([readErrorMessageForDisplay(error)]);
    } finally {
      setIsSaving(false);
    }
  }

  const locationOptions = locations.filter((location) => location.active).map((location) => ({ value: location.id, label: location.name }));
  return (
    <ModalDialog intent="transfer" isOpen={isOpen} onClose={onClose} title="Transfer stock" description="Stock leaves the source now and arrives when the receiving location confirms." width="large" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => void sendTransfer()} isBusy={isSaving}>Send transfer</Button></>}>
      <div className={styles.form}>
        {errorMessages.length > 0 ? <Callout tone="error">{errorMessages.map((message) => <p key={message}>{message}</p>)}</Callout> : null}
        <div className={styles.twoColumns}>
          <SelectField label="From" value={fromLocationId} onChange={(event) => setFromLocationId(event.target.value)} options={locationOptions} />
          <SelectField label="To" value={toLocationId} onChange={(event) => setToLocationId(event.target.value)} options={locationOptions} />
        </div>
        <VariantLinePicker locationId={fromLocationId} excludedVariantIds={new Set(lines.map((line) => line.variant.id))} onPick={(picked) => setLines((current) => [...current, { ...picked, quantityText: "" }])} />
        {lines.length > 0 ? (
          <table className={styles.lineTable}>
            <thead><tr><th>Item</th><th>At source</th><th>Send</th><th><span className="visuallyHidden">Remove line</span></th></tr></thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.variant.id}>
                  <td>{line.productName}{line.variant.title !== "Default" ? ` · ${line.variant.title}` : ""}</td>
                  <td>{availableAtSource(line)}</td>
                  <td><input className={styles.quantityInput} inputMode="numeric" aria-label={`Quantity to send of ${line.productName} ${line.variant.title}`} value={line.quantityText} onChange={(event) => setLines((current) => current.map((candidate) => (candidate.variant.id === line.variant.id ? { ...candidate, quantityText: event.target.value.replace(/\D/g, "") } : candidate)))} /></td>
                  <td><IconButton iconName="trash24" size="small" label="Remove line" onClick={() => setLines((current) => current.filter((candidate) => candidate.variant.id !== line.variant.id))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <TextAreaField label="Note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} hint="Optional, for example the driver's name." />
      </div>
    </ModalDialog>
  );
}
