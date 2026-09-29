"use client";

import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchCoinTransactions } from "@/services/moneyApi.service";
import type { CoinTransaction, CoinTransactionStatus } from "@/types/payouts.type";
import { formatMoneyForDisplay, formatRelativeTimeFromNow, formatWholeNumber, humanizeConstantName } from "@/utils/formatting.util";

import { CoinDetailPanel } from "./coinDetailPanel";
import styles from "./money.module.css";

type CoinTabKey = CoinTransactionStatus | "ALL";
const kindOptions = [
  { value: "ALL", label: "All kinds" },
  { value: "PURCHASE", label: "Purchases" },
  { value: "TRANSFER", label: "Transfers" },
  { value: "GIFT", label: "Gifts in lives" },
];

const coinColumns: readonly DataTableColumn<CoinTransaction>[] = [
  { key: "kind", header: "Kind", render: (coin) => <span className={styles.stack}><strong>{humanizeConstantName(coin.kind)}</strong><span className={styles.muted}>{coin.context}</span></span>, width: "24%" },
  { key: "from", header: "From", render: (coin) => <UserIdentity user={coin.sender} size={22} /> },
  { key: "to", header: "To", render: (coin) => (coin.receiver ? <UserIdentity user={coin.receiver} size={22} /> : <span className={styles.muted}>—</span>) },
  { key: "coins", header: "Coins", render: (coin) => formatWholeNumber(coin.coins), align: "end", isMono: true },
  { key: "value", header: "Value", render: (coin) => <span className={styles.stack}><span className={styles.amount}>{formatMoneyForDisplay(coin.fiatValue)}</span>{coin.platformFee ? <span className={styles.muted}>fee {formatMoneyForDisplay(coin.platformFee)}</span> : null}</span>, align: "end" },
  { key: "risk", header: "Chargeback risk", render: (coin) => <StatusBadge status={coin.chargebackRisk} /> },
  { key: "status", header: "Status", render: (coin) => <StatusBadge status={coin.status} hasDot={false} /> },
  { key: "when", header: "When", render: (coin) => <span className={styles.muted}>{formatRelativeTimeFromNow(coin.createdAt)}</span> },
];

export function CoinsWorkspace() {
  const [status, setStatus] = useState<CoinTabKey>("PENDING_REVIEW");
  const [kind, setKind] = useState("ALL");
  const [page, setPage] = useState(1);
  const [openTransactionId, setOpenTransactionId] = useState<string | null>(null);
  const filters = { status, kind, page };
  const { data, errorMessage, isLoading, reload } = useAdminQuery((signal) => fetchCoinTransactions(filters, signal), JSON.stringify(filters));
  const tabs = [
    { key: "PENDING_REVIEW" as const, label: "Needs review", count: data?.counts.PENDING_REVIEW ?? null },
    { key: "REVIEWED" as const, label: "Reviewed", count: data?.counts.REVIEWED ?? null },
    { key: "REVERSED" as const, label: "Reversed", count: data?.counts.REVERSED ?? null },
    { key: "ALL" as const, label: "All" },
  ];

  return (
    <>
      <PageHeader area="Money" title="Coins" description="Coin purchases, transfers and live gifts flagged for chargeback or abuse risk. Transfers carry a platform fee; gifts pay the creator their share." />
      <SegmentedTabs label="Review status" items={tabs} activeKey={status} onChange={(key) => { setStatus(key); setPage(1); }} />
      <Toolbar>
        <SelectField label="Kind" isLabelHidden options={kindOptions} value={kind} onChange={(event) => { setKind(event.target.value); setPage(1); }} className={styles.filterField} />
      </Toolbar>
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Coin transactions" columns={coinColumns} rows={data?.items ?? []} readRowKey={(coin) => coin.id} isLoading={isLoading} selectedRowKey={openTransactionId} onRowOpen={(coin) => setOpenTransactionId(coin.id)} readRowTone={(coin) => (coin.chargebackRisk === "HIGH" && coin.status === "PENDING_REVIEW" ? "danger" : null)} emptyMessage="Nothing to review." />
      {data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} /> : null}
      {openTransactionId ? <CoinDetailPanel key={openTransactionId} transactionId={openTransactionId} onClose={() => setOpenTransactionId(null)} onChanged={reload} /> : null}
    </>
  );
}
