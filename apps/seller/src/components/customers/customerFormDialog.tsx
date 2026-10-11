"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CheckboxField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import type { Customer } from "@/types/customer.type";
import { parseCustomerTagsText, validateCustomerProfileInput } from "@/utils/customerValidation.util";
import { convertIssuesToFieldErrorMap } from "@/utils/formValidation.util";

export function CustomerFormDialog({ isOpen, customer, onClose, onSaved }: { readonly isOpen: boolean; readonly customer: Customer | null; readonly onClose: () => void; readonly onSaved: (customer: Customer) => void }) {
  const { showToast } = useToast();
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [tagsText, setTagsText] = useState(customer?.tags.join(", ") ?? "");
  const [marketingOptIn, setMarketingOptIn] = useState(customer?.marketingOptIn ?? false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveCustomerProfile() {
    const input = { name: name.trim(), phone: phone.trim() || null, email: email.trim().toLowerCase() || null, tags: parseCustomerTagsText(tagsText), marketingOptIn };
    const issues = validateCustomerProfileInput(input);
    setFieldErrors(convertIssuesToFieldErrorMap(issues));
    if (issues.length > 0) return;
    setIsSaving(true);
    setFormError(null);
    try {
      const saved = customer
        ? await sendSellerApiRequest<Customer>(`/seller/customers/${customer.id}`, { method: "PATCH", body: input })
        : await sendSellerApiRequest<Customer>("/seller/customers", { method: "POST", body: input });
      showToast(customer ? "Customer saved." : `${saved.name} added to your customers.`);
      onSaved(saved);
      onClose();
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues?.length) setFieldErrors(convertIssuesToFieldErrorMap(error.issues));
      setFormError(readErrorMessageForDisplay(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalDialog intent="addMember"
      isOpen={isOpen}
      onClose={onClose}
      title={customer ? `Edit ${customer.name}` : "Add a customer"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" isBusy={isSaving} onClick={() => void saveCustomerProfile()}>
            {customer ? "Save customer" : "Add customer"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {formError ? <p role="alert" style={{ color: "var(--error-ink)", fontWeight: 500 }}>{formError}</p> : null}
        <TextField label="Full name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} errorMessage={fieldErrors.name} autoComplete="off" />
        <TextField label="Phone number" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={20} placeholder="+234 803 555 0142" errorMessage={fieldErrors.phone} hint="Used to match their app orders and send order updates." />
        <TextField label="Email (optional)" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} errorMessage={fieldErrors.email} />
        <TextField label="Tags (optional)" value={tagsText} onChange={(event) => setTagsText(event.target.value)} maxLength={200} placeholder="vip, wholesale" errorMessage={fieldErrors.tags} hint="Separate tags with commas." />
        <CheckboxField label="They agreed to receive offers and news" checked={marketingOptIn} onCheckedChange={setMarketingOptIn} />
      </div>
    </ModalDialog>
  );
}
