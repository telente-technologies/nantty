"use client";

import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchCoinTransactions } from "@/services/moneyApi.service";
import type { CoinReviewStatus, CoinTransaction } from "@/types/coins.type";
import { formatMoneyForDisplay, formatRelativeTimeFromNow, formatWholeNumber, humanizeConstantName } from "@/utils/formatting.util";
import { toIdentityUser } from "@/utils/partySummary.util";

import { CoinDetailPanel } from "./coinDetailPanel";
import styles from "./money.module.css";

type CoinTabKey = CoinReviewStatus | "all";
const kindOptions = [
  { value: "", label: "All kinds" },
  { value: "purchase", label: "Purchases" },
  { value: "transfer", label: "Transfers and gifts" },
];

const coinColumns: readonly DataTableColumn<CoinTransaction>[] = [
  { key: "kind", header: "Kind", render: (coin) => <span className={styles.stack}><strong>{humanizeConstantName(coin.kind)}</strong><span className={styles.muted}>{coin.reviewFlags.length > 0 ? coin.reviewFlags.map(humanizeConstantName).join(" · ") : (coin.channel ? humanizeConstantName(coin.channel) : "No rules hit")}</span></span>, width: "24%" },
  { key: "from", header: "From", render: (coin) => <UserIdentity user={toIdentityUser(coin.sender)} size={22} /> },
  { key: "to", header: "To", render: (coin) => (coin.receiver ? <UserIdentity user={toIdentityUser(coin.receiver)} size={22} /> : <span className={styles.muted}>—</span>) },
  { key: "coins", header: "Coins", render: (coin) => formatWholeNumber(coin.coins), align: "end", isMono: true },
  { key: "value", header: "Value", render: (coin) => <span className={styles.stack}><span className={styles.amount}>{formatMoneyForDisplay(coin.fiatValue)}</span>{coin.feeCoins !== null ? <span className={styles.muted}>fee {formatWholeNumber(coin.feeCoins)} coins</span> : null}</span>, align: "end" },
  { key: "risk", header: "Chargeback risk", render: (coin) => <StatusBadge status={coin.chargebackRisk} /> },
  { key: "status", header: "Review", render: (coin) => <StatusBadge status={coin.reviewStatus} hasDot={false} /> },
  { key: "when", header: "When", render: (coin) => <span className={styles.muted}>{formatRelativeTimeFromNow(coin.createdAt)}</span> },
];

export function CoinsWorkspace() {
  const [status, setStatus] = useState<CoinTabKey>("pending_review");
  const [kind, setKind] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [openTransactionId, setOpenTransactionId] = useState<string | null>(null);
  const filters = { status: status === "all" ? undefined : status, kind: kind || undefined, cursor };
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchCoinTransactions(filters, signal), JSON.stringify(filters));
  const tabs = [
    { key: "pending_review" as const, label: "Needs review", count: data?.counts.pending_review ?? null },
    { key: "reviewed" as const, label: "Reviewed", count: data?.counts.reviewed ?? null },
    { key: "reversed" as const, label: "Reversed", count: data?.counts.reversed ?? null },
    { key: "not_required" as const, label: "No review needed", count: data?.counts.not_required ?? null },
    { key: "all" as const, label: "All" },
  ];

  return (
    <>
      <PageHeader area="Money" title="Coins" description="Coin purchases and transfers (including live gifts) flagged by the coin rules for chargeback or abuse risk. Transfers carry a platform fee in coins." />
      <SegmentedTabs label="Review status" items={tabs} activeKey={status} onChange={(key) => { setStatus(key); setCursor(undefined); }} />
      <Toolbar>
        <SelectField label="Kind" isLabelHidden options={kindOptions} value={kind} onChange={(event) => { setKind(event.target.value); setCursor(undefined); }} className={styles.filterField} />
      </Toolbar>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Coin transactions" columns={coinColumns} rows={data?.items ?? []} readRowKey={(coin) => coin.id} isLoading={isLoading} selectedRowKey={openTransactionId} onRowOpen={(coin) => setOpenTransactionId(coin.id)} emptyMessage="Nothing to review." />
      <CursorPagination cursor={cursor} nextCursor={data?.nextCursor} onCursorChange={setCursor} />
      {openTransactionId ? <CoinDetailPanel key={openTransactionId} transactionId={openTransactionId} onClose={() => setOpenTransactionId(null)} onChanged={reload} /> : null}
    </>
  );
}
