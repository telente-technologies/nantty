"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField, TextField, readIssueMessageForField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, Toolbar, TwoColumnLayout } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { addReservedUsername, fetchReservedUsernames, fetchWithheldUsernames, removeReservedUsername } from "@/services/peopleApi.service";
import type { ReservedUsernameCategory, ReservedUsernameEntry, ReservedUsernameKind } from "@/types/usernames.type";
import { formatDateOnly, humanizeConstantName } from "@/utils/formatting.util";

import { ConfusableUsernameChecker } from "./confusableUsernameChecker";
import styles from "./peopleWorkspace.module.css";

const kindOptions = [{ value: "EXACT", label: "Exact name" }, { value: "PREFIX", label: "Prefix (name*)" }, { value: "PATTERN", label: "Pattern (*word*)" }];
const categoryOptions = ["BRAND", "GOVERNMENT", "SYSTEM", "OFFENSIVE", "PUBLIC_FIGURE"].map((value) => ({ value, label: humanizeConstantName(value) }));

export function ReservedUsernamesWorkspace() {
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [entryToRemove, setEntryToRemove] = useState<ReservedUsernameEntry | null>(null);
  const [newValue, setNewValue] = useState("");
  const [newKind, setNewKind] = useState<ReservedUsernameKind>("EXACT");
  const [newCategory, setNewCategory] = useState<ReservedUsernameCategory>("BRAND");
  const [newNote, setNewNote] = useState("");
  const filters = { search: search.trim() || undefined, kind: kindFilter || undefined };
  const reserved = useAdminQuery((signal) => fetchReservedUsernames(filters, signal), JSON.stringify(filters));
  const withheld = useAdminQuery((signal) => fetchWithheldUsernames(signal), "withheld");
  const addMutation = useAdminMutation((reason: string) => addReservedUsername({ value: newValue, kind: newKind, category: newCategory, note: newNote, reason }));
  const removeMutation = useAdminMutation(({ entryId, reason }: { entryId: string; reason: string }) => removeReservedUsername(entryId, reason));

  async function addEntry(reason: string) {
    const result = await addMutation.run(reason);
    if (!result) return;
    setIsAddOpen(false);
    setNewValue("");
    setNewNote("");
    reserved.reload();
    showToast(result.existingAccountsMatching.length > 0 ? `Reserved ${result.entry.value}. Existing accounts matching: ${result.existingAccountsMatching.join(", ")}` : `Reserved ${result.entry.value}`, result.existingAccountsMatching.length > 0 ? "info" : "success");
  }

  async function removeEntry(reason: string) {
    if (!entryToRemove) return;
    const result = await removeMutation.run({ entryId: entryToRemove.id, reason });
    if (result === null) return;
    showToast(`Removed ${entryToRemove.value}`);
    setEntryToRemove(null);
    reserved.reload();
  }

  const columns: DataTableColumn<ReservedUsernameEntry>[] = [
    { key: "value", header: "Name or pattern", render: (entry) => <strong className="mono">{entry.value}</strong> },
    { key: "kind", header: "Kind", render: (entry) => humanizeConstantName(entry.kind) },
    { key: "category", header: "Category", render: (entry) => <StatusBadge label={humanizeConstantName(entry.category)} tone={entry.category === "GOVERNMENT" ? "night" : entry.category === "OFFENSIVE" ? "danger" : "info"} hasDot={false} /> },
    { key: "note", header: "Note", render: (entry) => <span className={styles.muted}>{entry.note ?? ""}</span> },
    { key: "added", header: "Added", render: (entry) => <span className={styles.faint}>{formatDateOnly(entry.addedAt)} · {entry.addedByName}</span> },
    { key: "remove", header: "", align: "end", render: (entry) => <Button size="small" variant="ghost" iconName="trash24" aria-label={`Remove ${entry.value}`} onClick={() => setEntryToRemove(entry)} /> },
  ];

  return (
    <>
      <PageHeader area="People" title="Reserved usernames" description="Names nobody can register. Checks run on the normalized, confusable-folded form, so dаngote with a Cyrillic а is blocked too." actions={<Button variant="primary" iconName="plus16" onClick={() => setIsAddOpen(true)}>Reserve a name</Button>} />
      <TwoColumnLayout
        main={
          <>
            <Toolbar>
              <TextField label="Search" isLabelHidden type="search" placeholder="Search names and notes" value={search} onChange={(event) => setSearch(event.target.value)} />
              <SelectField label="Kind" isLabelHidden options={[{ value: "", label: "All kinds" }, ...kindOptions]} value={kindFilter} onChange={(event) => setKindFilter(event.target.value)} />
            </Toolbar>
            {reserved.errorMessage ? <ErrorBlock message={reserved.errorMessage} onRetry={reserved.reload} /> : null}
            <DataTable caption="Reserved usernames" columns={columns} rows={reserved.data?.items ?? []} readRowKey={(entry) => entry.id} isLoading={reserved.isLoading} emptyMessage="No reserved names match." />
          </>
        }
        aside={
          <>
            <ConfusableUsernameChecker />
            <Card title="Withheld usernames">
              {withheld.data && withheld.data.items.length > 0 ? (
                <ul className={styles.list}>
                  {withheld.data.items.map((entry) => (
                    <li key={entry.username} className={styles.listItem}>
                      <span className="mono">@{entry.username}</span>
                      <Link href={`/users/${entry.originalOwnerId}`}>{entry.originalOwnerDisplayName}</Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.faint}>No usernames are withheld right now. Withhold one from a user's Username tab.</p>
              )}
            </Card>
          </>
        }
      />
      <ConfirmActionDialog isOpen={isAddOpen} title="Reserve a name" confirmLabel="Reserve" isConfirmDisabled={newValue.trim().length < 2} isBusy={addMutation.isRunning} errorMessage={addMutation.validationIssues.length > 0 ? null : addMutation.errorMessage} onConfirm={addEntry} onClose={() => setIsAddOpen(false)}>
        <TextField label="Name or pattern" value={newValue} onChange={(event) => setNewValue(event.target.value.toLowerCase())} placeholder={newKind === "EXACT" ? "davido" : newKind === "PREFIX" ? "zudomart*" : "*official*"} error={readIssueMessageForField(addMutation.validationIssues, "value")} spellCheck={false} />
        <SelectField label="Kind" options={kindOptions} value={newKind} onChange={(event) => setNewKind(event.target.value as ReservedUsernameKind)} hint="Use * as a wildcard for prefixes and patterns. Regular expressions are not accepted." />
        <SelectField label="Category" options={categoryOptions} value={newCategory} onChange={(event) => setNewCategory(event.target.value as ReservedUsernameCategory)} />
        <TextField label="Note (optional)" value={newNote} onChange={(event) => setNewNote(event.target.value)} maxLength={200} />
      </ConfirmActionDialog>
      <ConfirmActionDialog isOpen={entryToRemove !== null} title={`Remove ${entryToRemove?.value ?? ""}`} description="Anyone will be able to register this name again." confirmLabel="Remove" tone="danger" isBusy={removeMutation.isRunning} errorMessage={removeMutation.errorMessage} onConfirm={removeEntry} onClose={() => setEntryToRemove(null)} />
    </>
  );
}
