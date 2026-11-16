"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { KpiTile } from "@/components/ui/kpiTile";
import { MoneyByCurrencyList } from "@/components/ui/moneyByCurrencyList";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchFinanceOverview } from "@/services/financeApi.service";
import type { FinanceRange } from "@/types/finance.type";
import { formatDateTime, formatWholeNumber } from "@/utils/formatting.util";

import styles from "./finance.module.css";
import { FinanceExportDialog } from "./financeExportDialog";

const rangeTabs = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
] as const;

const currencyOptions = [
  { value: "", label: "All currencies" },
  { value: "NGN", label: "NGN" },
  { value: "USD", label: "USD" },
  { value: "GBP", label: "GBP" },
  { value: "EUR", label: "EUR" },
];

export function FinanceOverviewWorkspace() {
  const { can } = useAdminPermissions();
  const [range, setRange] = useState<FinanceRange>("7d");
  const [currency, setCurrency] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const { data, errorMessage, error, isLoading, reload } = useAdminQuery(
    (signal) => fetchFinanceOverview(range, currency || undefined, signal),
    `${range}:${currency}`,
  );

  return (
    <>
      <PageHeader
        area="Finance"
        title="Finance overview"
        description="Cross-platform money positions, escrow health, payouts, and revenue streams."
        meta={data ? <span className={styles.muted}>Updated {formatDateTime(data.generatedAt)}</span> : null}
        actions={
          <>
            <SegmentedTabs label="Time range" items={rangeTabs} activeKey={range} onChange={setRange} />
            <Button variant="secondary" iconName="export24" onClick={() => setExportOpen(true)}>
              Export CSV
            </Button>
          </>
        }
      />
      <Toolbar>
        <SelectField label="Currency" isLabelHidden options={currencyOptions} value={currency} onChange={(event) => setCurrency(event.target.value)} />
        <div className={styles.quickLinks}>
          <ButtonLink href="/finance/issues" variant="secondary" size="small" iconName="warning20">Issues queue</ButtonLink>
          <ButtonLink href="/finance/lookup" variant="secondary" size="small" iconName="magnifyingGlass16">Reference lookup</ButtonLink>
          {can("orders:read") ? <ButtonLink href="/commerce/orders" variant="ghost" size="small">Orders</ButtonLink> : null}
          {can("payouts:approve") ? <ButtonLink href="/commerce/payouts" variant="ghost" size="small">Withdrawals</ButtonLink> : null}
          {can("disputes:resolve") ? <ButtonLink href="/commerce/disputes" variant="ghost" size="small">Disputes</ButtonLink> : null}
          {can("refunds:issue") ? <ButtonLink href="/commerce/refunds" variant="ghost" size="small">Refunds</ButtonLink> : null}
          {can("coins:review") ? <ButtonLink href="/commerce/coins" variant="ghost" size="small">Coins</ButtonLink> : null}
          {can("ledger:read") ? <ButtonLink href="/commerce/ledger" variant="ghost" size="small">Ledger</ButtonLink> : null}
          {can("payments:webhooks") ? <ButtonLink href="/commerce/webhooks" variant="ghost" size="small">Webhooks</ButtonLink> : null}
        </div>
      </Toolbar>
      {errorMessage ? <ErrorBlock error={error} message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !data ? <LoadingBlock lines={6} /> : null}
      {data ? (
        <div className={styles.layout}>
          <div className={styles.kpis}>
            <KpiTile label="Order GMV" value={<MoneyByCurrencyList amounts={data.gmvByCurrency} />} href="/commerce/orders" />
            <KpiTile label="Escrow held" value={<MoneyByCurrencyList amounts={data.escrowHeldByCurrency} />} href="/finance/escrow" detail={<span>Released: <MoneyByCurrencyList amounts={data.escrowReleasedByCurrency.slice(0, 1)} /></span>} />
            <KpiTile label="Escrow refunded" value={<MoneyByCurrencyList amounts={data.escrowRefundedByCurrency} />} href="/commerce/refunds" />
            <KpiTile label="Stuck escrows" value={formatWholeNumber(data.stuckEscrowsCount)} href="/finance/escrow" tone={data.stuckEscrowsCount > 0 ? "attention" : "default"} detail={<span>Missing auto-release</span>} />
            <KpiTile label="Open disputes" value={formatWholeNumber(data.disputesOpenCount)} href="/commerce/disputes" tone={data.disputesOpenCount > 0 ? "attention" : "default"} />
            <KpiTile label="Payouts pending" value={formatWholeNumber(data.payoutsPendingCount)} href="/commerce/payouts" detail={<MoneyByCurrencyList amounts={data.payoutsPendingByCurrency} />} />
            <KpiTile label="Aged processing payouts" value={formatWholeNumber(data.payoutsAgedCount)} href="/finance/issues" tone={data.payoutsAgedCount > 0 ? "attention" : "default"} detail={<span>Over 1 hour in processing</span>} />
            <KpiTile label="Coin sales" value={<MoneyByCurrencyList amounts={data.coinSalesByCurrency} />} href="/commerce/coins" />
            <KpiTile label="Ads top-ups" value={<MoneyByCurrencyList amounts={data.adTopUpsByCurrency} />} href="/finance/aspects" />
            <KpiTile label="Subscriptions" value={<MoneyByCurrencyList amounts={data.subscriptionByCurrency} />} href="/finance/aspects" />
            <KpiTile label="Platform revenue balances" value={<MoneyByCurrencyList amounts={data.platformRevenueByCurrency} />} href="/commerce/ledger" />
            <KpiTile label="Seller debt accounts" value={formatWholeNumber(data.sellerDebtAccountsCount)} href="/finance/issues" tone={data.sellerDebtAccountsCount > 0 ? "attention" : "default"} />
          </div>
          <Card title="Finance data sources" isFlush>
            <ul className={styles.healthList}>
              {data.health.map((source) => (
                <li key={source.name} className={styles.healthRow}>
                  <StatusBadge status={source.status} />
                  <strong>{source.name}</strong>
                  <span className={styles.muted}>{source.note ?? "Healthy"}</span>
                  <span className={styles.muted}>{source.latencyMs === null ? "" : `${source.latencyMs} ms`}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
      <FinanceExportDialog isOpen={exportOpen} reportType="overview" range={range} currency={currency} onClose={() => setExportOpen(false)} />
    </>
  );
}
