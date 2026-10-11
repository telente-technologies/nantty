"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { ReorderLevelUpdateRequest, ReorderSuggestionRow } from "@/types/productRequests.type";

export function ReorderLevelDialog({ row, onClose, onSaved }: { readonly row: ReorderSuggestionRow; readonly onClose: () => void; readonly onSaved: () => void }) {
  const { showToast } = useToast();
  const [reorderPointText, setReorderPointText] = useState(String(row.reorderPoint));
  const [reorderQuantityText, setReorderQuantityText] = useState(String(row.reorderQuantity));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveReorderLevels(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body: ReorderLevelUpdateRequest = { variantId: row.variantId, reorderPoint: Number(reorderPointText), reorderQuantity: Number(reorderQuantityText) };
    if (!Number.isInteger(body.reorderPoint) || body.reorderPoint < 0 || !Number.isInteger(body.reorderQuantity) || body.reorderQuantity < 1) {
      setErrorMessage("Use whole numbers: a reorder point of 0 or more and a quantity of at least 1.");
      return;
    }
    setIsSaving(true);
    try {
      await sendSellerApiRequest("/seller/inventory/reorder-levels", { method: "PATCH", body });
      showToast(`Reorder levels saved for ${row.productName}.`);
      onSaved();
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalDialog intent="inventory"
      isOpen
      onClose={onClose}
      width="small"
      title="Reorder levels"
      description={`${row.productName}${row.variantTitle === "Default" ? "" : ` · ${row.variantTitle}`}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="reorder-level-form" isBusy={isSaving}>Save</Button>
        </>
      }
    >
      <form id="reorder-level-form" onSubmit={(event) => void saveReorderLevels(event)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <TextField label="Reorder point" inputMode="numeric" value={reorderPointText} onChange={(event) => setReorderPointText(event.target.value.replace(/\D/g, ""))} hint="When available stock falls to this number, the item shows in your reorder list." errorMessage={errorMessage ?? undefined} />
        <TextField label="Reorder quantity" inputMode="numeric" value={reorderQuantityText} onChange={(event) => setReorderQuantityText(event.target.value.replace(/\D/g, ""))} hint="How many you usually order from the supplier." />
      </form>
    </ModalDialog>
  );
}
