"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { SelectField, TextAreaField, TextField, readIssueMessageForField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { createCatalogCategory, updateCatalogCategory, type CategoryEditorInput } from "@/services/catalogApi.service";
import type { CatalogCategory } from "@/types/catalog.type";

import styles from "./catalogForms.module.css";

interface CategoryEditorDialogProps {
  readonly editingCategory: CatalogCategory | null;
  readonly categories: readonly CatalogCategory[];
  readonly onClose: () => void;
  readonly onSaved: (category: CatalogCategory) => void;
}

export function CategoryEditorDialog({ editingCategory, categories, onClose, onSaved }: CategoryEditorDialogProps) {
  const [name, setName] = useState(editingCategory?.name ?? "");
  const [slug, setSlug] = useState(editingCategory?.slug ?? "");
  const [parentId, setParentId] = useState(editingCategory?.parentId ?? "");
  const [iconName, setIconName] = useState(editingCategory?.iconName ?? "");
  const [reason, setReason] = useState("");
  const hasChildren = editingCategory ? categories.some((category) => category.parentId === editingCategory.id) : false;
  const parentOptions = [{ value: "", label: "None — top-level category" }, ...categories.filter((category) => category.parentId === null && category.id !== editingCategory?.id).map((category) => ({ value: category.id, label: category.name }))];

  const saveMutation = useAdminMutation((input: CategoryEditorInput) => (editingCategory ? updateCatalogCategory(editingCategory.id, input) : createCatalogCategory(input)));

  async function submitCategory(event: FormEvent) {
    event.preventDefault();
    const result = await saveMutation.run({ name: name.trim(), slug: slug.trim() || undefined, parentId: parentId || null, iconName: iconName.trim() || null, reason: reason.trim() });
    if (result) onSaved(result.item);
  }

  return (
    <ModalDialog intent="tag" isOpen title={editingCategory ? `Edit ${editingCategory.name}` : "Add category"} description="Categories organise products in Mart and seller dashboards. Changes show in the app within a few minutes." onClose={onClose}>
      <form className={styles.form} onSubmit={submitCategory}>
        <div className={styles.twoColumns}>
          <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required error={readIssueMessageForField(saveMutation.validationIssues, "name")} />
          <TextField label="Slug" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} maxLength={80} placeholder="Generated from the name" hint="Used in links. Changing it breaks old links." error={readIssueMessageForField(saveMutation.validationIssues, "slug")} />
        </div>
        <div className={styles.twoColumns}>
          <SelectField label="Parent" options={parentOptions} value={parentId} onChange={(event) => setParentId(event.target.value)} disabled={hasChildren} hint={hasChildren ? "Has subcategories, so it stays top-level." : undefined} error={readIssueMessageForField(saveMutation.validationIssues, "parentId")} />
          <TextField label="App icon name" value={iconName} onChange={(event) => setIconName(event.target.value)} maxLength={40} placeholder="e.g. tag24" error={readIssueMessageForField(saveMutation.validationIssues, "iconName")} />
        </div>
        <TextAreaField label="Reason (saved to the audit log)" value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={1000} required />
        {saveMutation.errorMessage && saveMutation.validationIssues.length === 0 ? <InlineError message={saveMutation.errorMessage} /> : null}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isBusy={saveMutation.isRunning} disabled={name.trim().length < 2 || reason.trim().length < 5}>
            {editingCategory ? "Save category" : "Add category"}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
