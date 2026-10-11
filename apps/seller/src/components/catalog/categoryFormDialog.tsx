"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, SellerApiRequestError, sendSellerApiRequest } from "@/services/clientApi.service";
import type { ProductCategory } from "@/types/catalog.type";
import type { CategoryUpsertRequest } from "@/types/productRequests.type";
import { convertIssuesToFieldErrorMap } from "@/utils/formValidation.util";

export function CategoryFormDialog({ category, onClose, onSaved }: { readonly category: ProductCategory | null; readonly onClose: () => void; readonly onSaved: () => void }) {
  const { showToast } = useToast();
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setFieldErrors({ name: "Category names need 2 to 40 characters." });
      return;
    }
    setIsSaving(true);
    const body: CategoryUpsertRequest = { name: name.trim(), description: description.trim() };
    try {
      await sendSellerApiRequest(category ? `/seller/categories/${encodeURIComponent(category.id)}` : "/seller/categories", { method: category ? "PATCH" : "POST", body });
      showToast(category ? "Category saved." : `${body.name} added.`);
      onSaved();
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues && error.issues.length > 0) setFieldErrors(convertIssuesToFieldErrorMap(error.issues));
      else showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalDialog intent="tag"
      isOpen
      onClose={onClose}
      width="small"
      title={category ? `Edit ${category.name}` : "New category"}
      description="Customers browse your store page by category."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="category-form" isBusy={isSaving}>{category ? "Save" : "Add category"}</Button>
        </>
      }
    >
      <form id="category-form" onSubmit={(event) => void saveCategory(event)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <TextField label="Name" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} errorMessage={fieldErrors.name} required />
        <TextAreaField label="Description" value={description} maxLength={300} rows={3} onChange={(event) => setDescription(event.target.value)} errorMessage={fieldErrors.description} hint="Optional. Shown at the top of the category on your store page." />
      </form>
    </ModalDialog>
  );
}
