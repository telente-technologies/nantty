"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock, InlineError } from "@/components/ui/feedback";
import { TextAreaField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { createHelpCategory, deleteHelpCategory, fetchHelpCategories, updateHelpCategory } from "@/services/helpContentApi.service";
import type { HelpCategory, HelpCategoryInput } from "@/types/helpContent.type";

import styles from "./helpContent.module.css";

const emptyCategory: HelpCategoryInput = { slug: "", title: "", description: "", iconName: "question", position: 0 };

function CategoryFormDialog({ category, onClose, onSaved }: { readonly category: HelpCategory | null; readonly onClose: () => void; readonly onSaved: (message: string) => void }) {
  const [form, setForm] = useState<HelpCategoryInput>(category ? { slug: category.slug, title: category.title, description: category.description, iconName: category.iconName, position: category.position } : emptyCategory);
  const save = useAdminMutation((input: HelpCategoryInput) => (category ? updateHelpCategory(category.id, input) : createHelpCategory(input)));
  const update = (patch: Partial<HelpCategoryInput>) => setForm((current) => ({ ...current, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await save.run(form)) onSaved(category ? "Category updated" : "Category created");
  }

  return (
    <ModalDialog intent="edit" isOpen title={category ? "Edit category" : "New category"} onClose={onClose}>
      <form className={styles.stack} onSubmit={submit}>
        <TextField label="Title" value={form.title} onChange={(event) => update({ title: event.target.value })} required maxLength={80} />
        <TextField label="Address" hint="Lowercase words joined by dashes, used in the web link." value={form.slug} onChange={(event) => update({ slug: event.target.value })} required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
        <TextAreaField label="Description" value={form.description} onChange={(event) => update({ description: event.target.value })} rows={3} maxLength={300} />
        <TextField label="Icon name" value={form.iconName} onChange={(event) => update({ iconName: event.target.value })} />
        <TextField label="Order" type="number" min={0} value={String(form.position)} onChange={(event) => update({ position: Number(event.target.value) || 0 })} />
        {save.errorMessage ? <InlineError message={save.errorMessage} /> : null}
        <div className={styles.row}>
          <Button type="submit" variant="primary" isBusy={save.isRunning}>Save</Button>
          <Button type="button" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </ModalDialog>
  );
}

export function HelpCategoriesPanel({ canEdit }: { readonly canEdit: boolean }) {
  const { showToast } = useToast();
  const categories = useAdminQuery((signal) => fetchHelpCategories(signal), "help-categories-panel");
  const [editing, setEditing] = useState<HelpCategory | "new" | null>(null);
  const [deleting, setDeleting] = useState<HelpCategory | null>(null);
  const remove = useAdminMutation((categoryId: string) => deleteHelpCategory(categoryId));
  const columns: DataTableColumn<HelpCategory>[] = [
    { key: "title", header: "Category", render: (category) => <span className={styles.titleCell}><strong>{category.title}</strong><span className={styles.muted}>/{category.slug}</span></span> },
    { key: "description", header: "Description", render: (category) => <span className={styles.muted}>{category.description}</span> },
    { key: "count", header: "Published topics", render: (category) => category.topicCount, align: "end" },
    ...(canEdit ? [{ key: "actions", header: "", render: (category: HelpCategory) => (
      <span className={styles.row}>
        <Button size="small" onClick={() => setEditing(category)}>Edit</Button>
        <Button size="small" variant="quietDanger" onClick={() => setDeleting(category)}>Delete</Button>
      </span>
    ) }] : []),
  ];

  function finish(message: string) {
    setEditing(null);
    categories.reload();
    showToast(message);
  }

  return (
    <>
      {canEdit ? <div className={styles.row}><Button onClick={() => setEditing("new")}>New category</Button></div> : null}
      {categories.errorMessage ? <ErrorBlock error={categories.error} message={categories.errorMessage} onRetry={categories.reload} /> : null}
      <DataTable caption="Help categories" columns={columns} rows={categories.data?.items ?? []} readRowKey={(category) => category.id} isLoading={categories.isLoading} emptyMessage="No categories yet." />
      {editing ? <CategoryFormDialog category={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={finish} /> : null}
      <ConfirmActionDialog intent="delete"
        isOpen={deleting !== null}
        title={`Delete ${deleting?.title ?? "category"}?`}
        description="A category can only be deleted when it has no topics."
        confirmLabel="Delete category"
        tone="danger"
        isBusy={remove.isRunning}
        errorMessage={remove.errorMessage}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting && (await remove.run(deleting.id)) !== null) {
            setDeleting(null);
            finish("Category deleted");
          }
        }}
      />
    </>
  );
}
