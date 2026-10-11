"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, SellerApiRequestError, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Supplier } from "@/types/catalog.type";
import type { SupplierUpsertRequest } from "@/types/productRequests.type";
import { convertIssuesToFieldErrorMap } from "@/utils/formValidation.util";

import styles from "./inventoryDialogs.module.css";

function createSupplierFormValues(supplier: Supplier | null) {
  return {
    name: supplier?.name ?? "", contactName: supplier?.contactName ?? "", phone: supplier?.phone ?? "", email: supplier?.email ?? "",
    address: supplier?.address ?? "", leadTimeText: String(supplier?.leadTimeDays ?? 7), paymentTerms: supplier?.paymentTerms ?? "", notes: supplier?.notes ?? "",
  };
}

export function SupplierFormDialog({ supplier, onClose, onSaved }: { readonly supplier: Supplier | null; readonly onClose: () => void; readonly onSaved: () => void }) {
  const { showToast } = useToast();
  const [values, setValues] = useState(() => createSupplierFormValues(supplier));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const update = (patch: Partial<typeof values>) => setValues((current) => ({ ...current, ...patch }));

  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body: SupplierUpsertRequest = {
      name: values.name.trim(), contactName: values.contactName.trim(), phone: values.phone.trim(), email: values.email.trim() || null,
      address: values.address.trim(), leadTimeDays: Number(values.leadTimeText || "0"), paymentTerms: values.paymentTerms.trim(), notes: values.notes.trim() || null,
    };
    setIsSaving(true);
    setFieldErrors({});
    try {
      await sendSellerApiRequest(supplier ? `/seller/suppliers/${encodeURIComponent(supplier.id)}` : "/seller/suppliers", { method: supplier ? "PATCH" : "POST", body });
      showToast(supplier ? "Supplier saved." : `${body.name} added.`);
      onSaved();
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues && error.issues.length > 0) setFieldErrors(convertIssuesToFieldErrorMap(error.issues));
      else showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalDialog intent="delivery"
      isOpen
      onClose={onClose}
      width="medium"
      title={supplier ? `Edit ${supplier.name}` : "New supplier"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="supplier-form" isBusy={isSaving}>{supplier ? "Save" : "Add supplier"}</Button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={(event) => void saveSupplier(event)} className={styles.formGrid}>
        <TextField label="Business name" value={values.name} maxLength={80} required onChange={(event) => update({ name: event.target.value })} errorMessage={fieldErrors.name} />
        <TextField label="Contact person" value={values.contactName} maxLength={80} onChange={(event) => update({ contactName: event.target.value })} errorMessage={fieldErrors.contactName} />
        <TextField label="Phone" type="tel" value={values.phone} maxLength={20} placeholder="+234 803 555 0142" required onChange={(event) => update({ phone: event.target.value })} errorMessage={fieldErrors.phone} />
        <TextField label="Email" type="email" value={values.email} maxLength={120} onChange={(event) => update({ email: event.target.value })} errorMessage={fieldErrors.email} />
        <TextField className={styles.fullRow} label="Address" value={values.address} maxLength={200} onChange={(event) => update({ address: event.target.value })} errorMessage={fieldErrors.address} />
        <TextField label="Lead time (days)" inputMode="numeric" value={values.leadTimeText} onChange={(event) => update({ leadTimeText: event.target.value.replace(/\D/g, "").slice(0, 3) })} errorMessage={fieldErrors.leadTimeDays} hint="Days from order to delivery." />
        <TextField label="Payment terms" value={values.paymentTerms} maxLength={80} placeholder="e.g. Pay on delivery" onChange={(event) => update({ paymentTerms: event.target.value })} errorMessage={fieldErrors.paymentTerms} />
        <TextAreaField className={styles.fullRow} label="Notes" value={values.notes} maxLength={500} rows={3} onChange={(event) => update({ notes: event.target.value })} errorMessage={fieldErrors.notes} />
      </form>
    </ModalDialog>
  );
}
