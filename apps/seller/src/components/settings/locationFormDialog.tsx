"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import type { StoreLocation } from "@/types/store.type";
import { convertIssuesToFieldErrorMap, fieldChecks, validateObjectAgainstChecks } from "@/utils/formValidation.util";

import styles from "./settings.module.css";

const locationChecks = {
  name: fieldChecks.text({ label: "Location name", min: 2, max: 60 }),
  kind: fieldChecks.oneOf("Location type", ["store", "warehouse"] as const),
  address: fieldChecks.text({ label: "Address", min: 5, max: 200 }),
  city: fieldChecks.text({ label: "City", min: 2, max: 60 }),
  state: fieldChecks.text({ label: "State or region", min: 2, max: 60 }),
  phone: fieldChecks.optional(fieldChecks.phone()),
};

export function LocationFormDialog({ location, isOpen, onClose, onSaved }: { readonly location: StoreLocation | null; readonly isOpen: boolean; readonly onClose: () => void; readonly onSaved: () => void }) {
  const [draft, setDraft] = useState({ name: location?.name ?? "", kind: location?.kind ?? "store", address: location?.address ?? "", city: location?.city ?? "", state: location?.state ?? "", phone: location?.phone ?? "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  function updateDraftField(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveLocation() {
    const issues = validateObjectAgainstChecks(draft, locationChecks);
    setFieldErrors(convertIssuesToFieldErrorMap(issues));
    if (issues.length > 0) return;
    setIsSaving(true);
    const body = { ...draft, phone: draft.phone.trim() || null };
    try {
      if (location) await sendSellerApiRequest(`/seller/locations/${encodeURIComponent(location.id)}`, { method: "PATCH", body });
      else await sendSellerApiRequest("/seller/locations", { method: "POST", body });
      showToast(location ? "Location saved." : "Location added.");
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues?.length) setFieldErrors(convertIssuesToFieldErrorMap(error.issues));
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalDialog intent="location"
      isOpen={isOpen}
      onClose={onClose}
      title={location ? `Edit ${location.name}` : "Add a location"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" isBusy={isSaving} onClick={() => void saveLocation()}>
            {location ? "Save location" : "Add location"}
          </Button>
        </>
      }
    >
      <div className={styles.fieldset}>
        <div className={styles.twoColumns}>
          <TextField label="Name" value={draft.name} maxLength={60} onChange={(event) => updateDraftField("name", event.target.value)} errorMessage={fieldErrors.name} />
          <SelectField label="Type" value={draft.kind} onChange={(event) => updateDraftField("kind", event.target.value)} options={[{ value: "store", label: "Store (sells in person)" }, { value: "warehouse", label: "Warehouse (stock only)" }]} errorMessage={fieldErrors.kind} />
        </div>
        <TextField label="Street address" value={draft.address} maxLength={200} onChange={(event) => updateDraftField("address", event.target.value)} errorMessage={fieldErrors.address} />
        <div className={styles.twoColumns}>
          <TextField label="City" value={draft.city} maxLength={60} onChange={(event) => updateDraftField("city", event.target.value)} errorMessage={fieldErrors.city} />
          <TextField label="State or region" value={draft.state} maxLength={60} onChange={(event) => updateDraftField("state", event.target.value)} errorMessage={fieldErrors.state} />
          <TextField label="Phone (optional)" type="tel" value={draft.phone} maxLength={20} onChange={(event) => updateDraftField("phone", event.target.value)} errorMessage={fieldErrors.phone} />
        </div>
      </div>
    </ModalDialog>
  );
}
