"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { ErrorBlock, InlineError, LoadingBlock } from "@/components/ui/feedback";
import { SelectField, TextAreaField, TextField, readIssueMessageForField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { supportCategoryOptions } from "@/constants/supportOptions.constant";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { createSupportMacro, deleteSupportMacro, fetchSupportMacros, updateSupportMacro, type SupportMacroInput } from "@/services/supportApi.service";
import type { SupportMacro, SupportTicketCategory } from "@/types/support.type";
import { formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./macrosManagerDialog.module.css";

export function MacrosManagerDialog({ canManage, onClose }: { readonly canManage: boolean; readonly onClose: () => void }) {
  const { showToast } = useToast();
  const [changeCounter, setChangeCounter] = useState(0);
  const [editingMacro, setEditingMacro] = useState<SupportMacro | "new" | null>(null);
  const [deletingMacro, setDeletingMacro] = useState<SupportMacro | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const macros = useAdminQuery((signal) => fetchSupportMacros(signal), `macros:${changeCounter}`);
  const saveMutation = useAdminMutation((input: SupportMacroInput) => (editingMacro && editingMacro !== "new" ? updateSupportMacro(editingMacro.id, input) : createSupportMacro(input)));
  const deleteMutation = useAdminMutation((macroId: string) => deleteSupportMacro(macroId));

  function startEditing(macro: SupportMacro | "new") {
    setEditingMacro(macro);
    setTitle(macro === "new" ? "" : macro.title);
    setBody(macro === "new" ? "" : macro.body);
    setCategory(macro === "new" ? "" : (macro.category ?? ""));
    saveMutation.clearError();
  }

  async function saveMacro(event: FormEvent) {
    event.preventDefault();
    const saved = await saveMutation.run({ title: title.trim(), body: body.trim(), category: (category || null) as SupportTicketCategory | null });
    if (!saved) return;
    showToast(`Macro “${saved.title}” saved`);
    setEditingMacro(null);
    setChangeCounter((current) => current + 1);
  }

  async function confirmDelete() {
    if (!deletingMacro) return;
    const result = await deleteMutation.run(deletingMacro.id);
    if (result === null) return;
    showToast(`Macro “${deletingMacro.title}” deleted`);
    setDeletingMacro(null);
    setChangeCounter((current) => current + 1);
  }

  return (
    <ModalDialog intent="notes" isOpen width="wide" title="Reply macros" description="Saved replies agents insert into tickets. Variables are filled in for each customer." onClose={onClose} footer={canManage && !editingMacro ? <Button variant="primary" iconName="plus16" onClick={() => startEditing("new")}>New macro</Button> : undefined}>
      {macros.errorMessage ? <ErrorBlock error={macros.error} message={macros.errorMessage} onRetry={macros.reload} /> : null}
      {macros.isLoading && !macros.data ? <LoadingBlock lines={4} /> : null}
      {editingMacro ? (
        <form className={styles.form} onSubmit={saveMacro}>
          <div className={styles.row}>
            <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required error={readIssueMessageForField(saveMutation.validationIssues, "title")} />
            <SelectField label="Category" options={[{ value: "", label: "Any category" }, ...supportCategoryOptions.slice(1)]} value={category} onChange={(event) => setCategory(event.target.value)} />
          </div>
          <TextAreaField label="Reply text" value={body} onChange={(event) => setBody(event.target.value)} rows={6} maxLength={3000} required hint={`Variables: ${(macros.data?.variables ?? []).map((variable) => `{{${variable}}}`).join(" ")}`} error={readIssueMessageForField(saveMutation.validationIssues, "body")} />
          {saveMutation.errorMessage && saveMutation.validationIssues.length === 0 ? <InlineError message={saveMutation.errorMessage} /> : null}
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setEditingMacro(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isBusy={saveMutation.isRunning}>
              Save macro
            </Button>
          </div>
        </form>
      ) : (
        <ul className={styles.list}>
          {(macros.data?.items ?? []).map((macro) => (
            <li key={macro.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <strong>{macro.title}</strong>
                <StatusBadge label={macro.category ? humanizeConstantName(macro.category) : "Any category"} tone="neutral" hasDot={false} />
                <span className={styles.meta}>
                  {macro.updatedByName} · {formatRelativeTimeFromNow(macro.updatedAt)}
                </span>
                {canManage ? (
                  <span className={styles.itemActions}>
                    <Button size="small" variant="ghost" onClick={() => startEditing(macro)}>
                      Edit
                    </Button>
                    <Button size="small" variant="quietDanger" onClick={() => setDeletingMacro(macro)}>
                      Delete
                    </Button>
                  </span>
                ) : null}
              </div>
              <p className={styles.body}>{macro.body}</p>
            </li>
          ))}
        </ul>
      )}
      <ConfirmActionDialog intent="delete" isOpen={deletingMacro !== null} title={`Delete “${deletingMacro?.title ?? ""}”?`} consequences={["Agents can no longer insert it. Replies already sent are not changed."]} confirmLabel="Delete macro" tone="danger" requiresReason={false} isBusy={deleteMutation.isRunning} errorMessage={deleteMutation.errorMessage} onConfirm={() => void confirmDelete()} onClose={() => setDeletingMacro(null)} />
    </ModalDialog>
  );
}
