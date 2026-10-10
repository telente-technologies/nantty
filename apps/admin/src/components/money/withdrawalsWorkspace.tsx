"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchWithdrawals } from "@/services/moneyApi.service";
import type { StaffWithdrawal, WithdrawalStatus } from "@/types/withdrawals.type";
import { formatMoneyForDisplay, formatRelativeTimeFromNow } from "@/utils/formatting.util";
import { toIdentityUser } from "@/utils/partySummary.util";

import styles from "./money.module.css";
import { WithdrawalDetailPanel } from "./withdrawalDetailPanel";

type WithdrawalTabKey = WithdrawalStatus | "all";

const tabLabels: Readonly<Record<WithdrawalStatus, string>> = { pending_review: "Needs review", on_hold: "On hold", queued: "Queued", processing: "Processing", paid: "Paid", failed: "Failed or rejected", cancelled: "Cancelled" };

const withdrawalColumns: readonly DataTableColumn<StaffWithdrawal>[] = [
  { key: "user", header: "User", render: (withdrawal) => <UserIdentity user={toIdentityUser(withdrawal.user)} size={24} /> },
  { key: "amount", header: "Amount", render: (withdrawal) => <span className={styles.stack}><span className={styles.amount}>{formatMoneyForDisplay(withdrawal.amount)}</span><span className={styles.muted}>fee {formatMoneyForDisplay(withdrawal.fee)}</span></span>, align: "end" },
  { key: "destination", header: "Destination", render: (withdrawal) => (withdrawal.destination ? <span className={styles.stack}><span>{withdrawal.destination.bankName} <span className="mono">••••{withdrawal.destination.accountLast4}</span></span><span className={styles.muted}>added {formatRelativeTimeFromNow(withdrawal.destination.addedAt)}{withdrawal.destination.removed ? " · removed since" : ""}</span></span> : <span className={styles.muted}>Account not found</span>) },
  { key: "reference", header: "Reference", render: (withdrawal) => withdrawal.reference, isMono: true },
  { key: "status", header: "Status", render: (withdrawal) => <StatusBadge status={withdrawal.withdrawalStatus} /> },
  { key: "requested", header: "Requested", render: (withdrawal) => <span className={styles.muted}>{formatRelativeTimeFromNow(withdrawal.createdAt)}</span> },
];

export function WithdrawalsWorkspace() {
  const [status, setStatus] = useState<WithdrawalTabKey>("pending_review");
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [openWithdrawalId, setOpenWithdrawalId] = useState<string | null>(null);
  const filters = { status: status === "all" ? undefined : status, search: appliedSearch || undefined, cursor };
  const { data, errorMessage, isLoading, reload } = useAdminQuery((signal) => fetchWithdrawals(filters, signal), JSON.stringify(filters));
  const tabs = (Object.keys(tabLabels) as WithdrawalStatus[]).map((key) => ({ key: key as WithdrawalTabKey, label: tabLabels[key], count: data?.counts[key] ?? null }));

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setAppliedSearch(searchText.trim());
    setCursor(undefined);
  }

  return (
    <>
      <PageHeader area="Money" title="Withdrawals" description="Withdrawals waiting for a person. Approving queues the payout to the bank; holding keeps the money reserved until someone decides." />
      <SegmentedTabs label="Withdrawal status" items={[...tabs, { key: "all", label: "All" }]} activeKey={status} onChange={(key) => { setStatus(key); setCursor(undefined); }} />
      <form onSubmit={applySearch}>
        <Toolbar>
          <TextField label="Search withdrawals" isLabelHidden placeholder="Withdrawal ID, user ID or reference" value={searchText} onChange={(event) => setSearchText(event.target.value)} className={styles.searchField} />
          <Button type="submit" iconName="magnifyingGlass16">Search</Button>
        </Toolbar>
      </form>
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Withdrawal requests" columns={withdrawalColumns} rows={data?.items ?? []} readRowKey={(withdrawal) => withdrawal.id} isLoading={isLoading} selectedRowKey={openWithdrawalId} onRowOpen={(withdrawal) => setOpenWithdrawalId(withdrawal.id)} readRowTone={(withdrawal) => (withdrawal.destination?.removed ? "caution" : null)} emptyMessage="No withdrawals in this state." />
      <CursorPagination cursor={cursor} nextCursor={data?.nextCursor} onCursorChange={setCursor} />
      {openWithdrawalId ? <WithdrawalDetailPanel key={openWithdrawalId} withdrawalId={openWithdrawalId} onClose={() => setOpenWithdrawalId(null)} onChanged={reload} /> : null}
    </>
  );
}
