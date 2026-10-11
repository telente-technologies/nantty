"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock, NoticeBanner } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { decideSuspensionAppeal, fetchSuspendedAccounts, reinstateSuspendedAccount } from "@/services/safetyApi.service";
import type { SuspendedAccount } from "@/types/suspensions.type";
import { formatDateOnly, formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./trustShared.module.css";

type AccountAction = { readonly kind: "reinstate" | "uphold" | "overturn"; readonly account: SuspendedAccount };

const actionCopy = {
  reinstate: { title: "Reinstate this account", confirm: "Reinstate", danger: false, consequences: (name: string) => [`@${name} can sign in and use the app again.`, "The 120-day deletion clock stops and is cleared."] },
  uphold: { title: "Uphold the suspension", confirm: "Uphold suspension", danger: true, consequences: () => ["The appeal is closed and the person is told the decision stands.", "The deletion clock keeps running."] },
  overturn: { title: "Overturn on appeal", confirm: "Overturn and reinstate", danger: false, consequences: (name: string) => [`@${name} is reinstated right away.`, "The deletion clock stops."] },
} as const;

function CountdownLabel({ account }: { readonly account: SuspendedAccount }) {
  const tone = account.daysUntilDeletion <= 14 ? styles.overdue : styles.muted;
  return <span className={tone}>{account.daysUntilDeletion} days left · {formatDateOnly(account.deletionDueAt)}</span>;
}

export function SuspendedAccountsPanel({ appealsOnly }: { readonly appealsOnly: boolean }) {
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [action, setAction] = useState<AccountAction | null>(null);
  const filters = { appeal: appealsOnly ? "PENDING" : undefined, search: search || undefined, cursor };
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchSuspendedAccounts(filters, signal), JSON.stringify(filters));
  const { showToast } = useToast();
  const mutation = useAdminMutation(async (input: { action: AccountAction; reason: string }) => {
    const caseId = input.action.account.caseId;
    if (input.action.kind === "reinstate") return reinstateSuspendedAccount(caseId, input.reason);
    return decideSuspensionAppeal(caseId, input.action.kind === "uphold" ? "UPHELD" : "OVERTURNED", input.reason);
  });

  async function confirm(reason: string) {
    if (!action) return;
    if (await mutation.run({ action, reason })) {
      showToast(`${actionCopy[action.kind].confirm}: done. Logged to the audit trail.`);
      setAction(null);
      reload();
    }
  }

  const columns: readonly DataTableColumn<SuspendedAccount>[] = [
    { key: "user", header: "Account", render: (account) => <UserIdentity user={account.user} size={24} /> },
    { key: "reason", header: "Reason", render: (account) => humanizeConstantName(account.reasonCode) },
    { key: "since", header: "Suspended", render: (account) => formatDateTime(account.suspendedAt) },
    { key: "deletion", header: "Data deletion", render: (account) => <CountdownLabel account={account} /> },
    { key: "appeal", header: "Appeal", render: (account) => account.appeal ? <StatusBadge status={account.appeal.status} /> : <span className={styles.muted}>None</span> },
    {
      key: "actions", header: "", align: "end", width: "250px",
      render: (account) => (
        <span style={{ display: "inline-flex", gap: 6 }}>
          {account.appeal?.status === "PENDING" ? (<><Button size="small" variant="quietDanger" iconName="shield24" onClick={() => setAction({ kind: "uphold", account })}>Uphold</Button><Button size="small" iconName="shield24" onClick={() => setAction({ kind: "overturn", account })}>Overturn</Button></>) : null}
          <Button size="small" variant="ghost" iconName="shield24" onClick={() => setAction({ kind: "reinstate", account })}>Reinstate</Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <NoticeBanner tone="caution" title="What happens after 120 days">
        The profile, posts, media and messages are deleted. Order and payment records are kept for the legal period, with the person's identity anonymised. Reinstating an account stops the clock.
      </NoticeBanner>
      <Toolbar>
        <div className={styles.filters}>
          <TextField label="Search" isLabelHidden type="search" placeholder="Search @username or name" value={search} onChange={(event) => { setSearch(event.target.value); setCursor(undefined); }} />
        </div>
      </Toolbar>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption={appealsOnly ? "Appeal queue" : "Suspended accounts"} columns={columns} rows={data?.items ?? []} readRowKey={(account) => account.caseId} isLoading={isLoading} emptyMessage={appealsOnly ? "No appeals waiting." : "No suspended accounts."} />
      <CursorPagination cursor={cursor} nextCursor={data?.nextCursor} onCursorChange={setCursor} />
      {action ? (
        <ConfirmActionDialog intent="suspend" isOpen title={actionCopy[action.kind].title} consequences={actionCopy[action.kind].consequences(action.account.user.username)} confirmLabel={actionCopy[action.kind].confirm} tone={actionCopy[action.kind].danger ? "danger" : "default"} requiresStepUp isBusy={mutation.isRunning} errorMessage={mutation.errorMessage} onConfirm={confirm} onClose={() => { mutation.clearError(); setAction(null); }}>
          {action.account.appeal ? <p className={styles.statement}>{action.account.appeal.message}</p> : null}
        </ConfirmActionDialog>
      ) : null}
    </>
  );
}
