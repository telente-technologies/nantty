"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField, TextField, readIssueMessageForField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { Card, Toolbar, TwoColumnLayout } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { addReservedUsername, fetchHeldUsernames, fetchReservedUsernames, fetchWithheldUsernames, removeReservedUsername } from "@/services/peopleApi.service";
import type { ReservedUsernameMatchKind, ReservedUsernameRule } from "@/types/usernames.type";
import { formatDateOnly } from "@/utils/formatting.util";

import { ConfusableUsernameChecker } from "./confusableUsernameChecker";
import styles from "./peopleWorkspace.module.css";

const kindOptions: { value: ReservedUsernameMatchKind; label: string }[] = [{ value: "exact", label: "Exact name" }, { value: "prefix", label: "Starts with" }, { value: "contains", label: "Contains" }, { value: "brand", label: "Brand" }];
const kindLabels = Object.fromEntries(kindOptions.map((option) => [option.value, option.label])) as Record<ReservedUsernameMatchKind, string>;

export function ReservedUsernamesWorkspace() {
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [entryToRemove, setEntryToRemove] = useState<ReservedUsernameRule | null>(null);
  const [newValue, setNewValue] = useState("");
  const [newKind, setNewKind] = useState<ReservedUsernameMatchKind>("exact");
  const [cursors, setCursors] = useState<readonly (string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1] ?? null;
  const reserved = useAdminQuery((signal) => fetchReservedUsernames(cursor, signal), cursor ?? "first");
  const searchText = search.trim().toLowerCase();
  const visibleRules = (reserved.data?.items ?? []).filter((rule) => (!searchText || rule.term.includes(searchText)) && (!kindFilter || rule.matchKind === kindFilter));
  const nextCursor = reserved.data?.nextCursor ?? null;
  const held = useAdminQuery((signal) => fetchHeldUsernames(signal), "held");
  const withheld = useAdminQuery((signal) => fetchWithheldUsernames(signal), "withheld");
  const addMutation = useAdminMutation(() => addReservedUsername({ term: newValue.trim(), matchKind: newKind }));
  const removeMutation = useAdminMutation((ruleId: string) => removeReservedUsername(ruleId));

  async function addEntry() {
    const result = await addMutation.run(undefined);
    if (!result) return;
    setIsAddOpen(false);
    setNewValue("");
    setCursors([null]);
    reserved.reload();
    showToast(`Reserved ${result.term}`);
  }

  async function removeEntry() {
    if (!entryToRemove) return;
    const result = await removeMutation.run(entryToRemove.id);
    if (result === null) return;
    showToast(`Removed ${entryToRemove.term}`);
    setEntryToRemove(null);
    reserved.reload();
  }

  const columns: DataTableColumn<ReservedUsernameRule>[] = [
    { key: "term", header: "Name", render: (rule) => <strong className="mono">{rule.term}</strong> },
    { key: "kind", header: "Match", render: (rule) => kindLabels[rule.matchKind] ?? rule.matchKind },
    { key: "added", header: "Added", render: (rule) => <span className={styles.faint}>{rule.createdAt ? formatDateOnly(rule.createdAt) : ""}</span> },
    { key: "remove", header: "", align: "end", render: (rule) => <Button size="small" variant="ghost" iconName="trash24" aria-label={`Remove ${rule.term}`} onClick={() => setEntryToRemove(rule)} /> },
  ];

  return (
    <>
      <PageHeader area="People" title="Reserved usernames" description="Names nobody can register. Checks run on the normalized, confusable-folded form, so dаngote with a Cyrillic а is blocked too." actions={<Button variant="primary" iconName="plus16" onClick={() => setIsAddOpen(true)}>Reserve a name</Button>} />
      <TwoColumnLayout
        main={
          <>
            <Toolbar>
              <TextField label="Search" isLabelHidden type="search" placeholder="Search names on this page" value={search} onChange={(event) => setSearch(event.target.value)} />
              <SelectField label="Kind" isLabelHidden options={[{ value: "", label: "All kinds" }, ...kindOptions]} value={kindFilter} onChange={(event) => setKindFilter(event.target.value)} />
            </Toolbar>
            {reserved.errorMessage ? <ErrorBlock error={reserved.error} message={reserved.errorMessage} onRetry={reserved.reload} /> : null}
            <DataTable caption="Reserved usernames" columns={columns} rows={visibleRules} readRowKey={(rule) => rule.id} isLoading={reserved.isLoading} emptyMessage="No reserved names match." />
            <Toolbar>
              <Button size="small" disabled={cursors.length < 2} onClick={() => setCursors((current) => current.slice(0, -1))}>Previous</Button>
              <Button size="small" disabled={!nextCursor} onClick={() => nextCursor && setCursors((current) => [...current, nextCursor])}>Next</Button>
            </Toolbar>
          </>
        }
        aside={
          <>
            <ConfusableUsernameChecker />
            <Card title="Held usernames (120 days)">
              {held.data && held.data.items.length > 0 ? (
                <ul className={styles.list}>
                  {held.data.items.map((entry) => (
                    <li key={entry.username} className={styles.listItem}>
                      <span className="mono">@{entry.username}</span>
                      <span className={styles.faint}>{entry.isHeld ? `Released ${formatDateOnly(entry.releasedAt)}, available ${formatDateOnly(entry.availableAt)}` : `Available since ${formatDateOnly(entry.availableAt)}`}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.faint}>No usernames are in their 120-day hold.</p>
              )}
            </Card>
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
      <ConfirmActionDialog intent="lock" isOpen={isAddOpen} title="Reserve a name" confirmLabel="Reserve" requiresReason={false} isConfirmDisabled={!/^[a-z0-9._]{2,30}$/.test(newValue.trim())} isBusy={addMutation.isRunning} errorMessage={addMutation.validationIssues.length > 0 ? null : addMutation.errorMessage} onConfirm={addEntry} onClose={() => setIsAddOpen(false)}>
        <TextField label="Name" value={newValue} onChange={(event) => setNewValue(event.target.value.toLowerCase())} placeholder={newKind === "exact" ? "davido" : "zudomart"} error={readIssueMessageForField(addMutation.validationIssues, "term")} spellCheck={false} hint="2–30 letters, numbers, dots or underscores. No wildcards." />
        <SelectField label="Match" options={kindOptions} value={newKind} onChange={(event) => setNewKind(event.target.value as ReservedUsernameMatchKind)} hint="Starts with and Contains block every username built on this name." />
      </ConfirmActionDialog>
      <ConfirmActionDialog intent="remove" isOpen={entryToRemove !== null} title={`Remove ${entryToRemove?.term ?? ""}`} description="Anyone will be able to register this name again." confirmLabel="Remove" tone="danger" requiresReason={false} isBusy={removeMutation.isRunning} errorMessage={removeMutation.errorMessage} onConfirm={removeEntry} onClose={() => setEntryToRemove(null)} />
    </>
  );
}
