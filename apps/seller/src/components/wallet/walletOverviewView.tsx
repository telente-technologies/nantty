"use client";

import { useState } from "react";

import { AccountingExportPanel, FinanceSummarySection, UpcomingEscrowReleasesPanel } from "@/components/wallet/financeSummaryPanels";
import { WalletBalanceCards } from "@/components/wallet/walletBalanceCards";
import { walletBalanceBucketLabels, walletTransactionKindLabels } from "@/components/wallet/walletPresentation.constant";
import { PayoutSetupBanner } from "@/components/payouts/payoutSetupBanner";
import { WalletTabs } from "@/components/wallet/walletTabs";
import { useWalletCursorPages } from "@/components/wallet/useWalletCursorPages.hook";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { EmptyState, ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { DateRangeControl, FilterBar, type DateRangeValue } from "@/components/ui/filterControls";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { FinanceSummary } from "@/types/finance.type";
import type { WalletBalances, WalletTransaction } from "@/types/wallet.type";
import { buildDateRangeEndingToday, formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./wallet.module.css";


function WalletTransactionsPanel() {
  const { formatMoney } = useMoneyFormatter();
  const [kind, setKind] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => buildDateRangeEndingToday(90));
  const transactions = useWalletCursorPages<WalletTransaction>("/seller/wallet/transactions", { kind, from: dateRange.from, to: dateRange.to, limit: 25 });
  return (
    <Panel
      padded={false}
      title="Transactions"
      actions={
        <FilterBar>
          <label>
            <span className="visuallyHidden">Transaction type</span>
            <select className={styles.filterSelect} value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="">All types</option>
              {Object.entries(walletTransactionKindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <DateRangeControl value={dateRange} onValueChange={setDateRange} />
        </FilterBar>
      }
    >
      <DataTable
        caption="Wallet transactions"
        rows={transactions.items}
        readRowKey={(transaction) => transaction.id}
        isLoading={transactions.isLoading}
        errorMessage={transactions.errorMessage}
        onRetry={transactions.reload}
        hasMore={transactions.hasMore}
        isLoadingMore={transactions.isLoadingMore}
        onLoadMore={() => void transactions.loadNextPage()}
        emptyState={<EmptyState iconName="creditCard24" title="No transactions match these filters" description="Try another type or a wider date range." />}
        columns={[
          { key: "date", header: "Date", render: (transaction) => formatDateTimeForDisplay(transaction.createdAt) },
          { key: "description", header: "Description", render: (transaction) => transaction.description },
          { key: "kind", header: "Type", hideBelowTablet: true, render: (transaction) => <StatusBadge tone={transaction.direction === "credit" ? "success" : "neutral"}>{walletTransactionKindLabels[transaction.kind]}</StatusBadge> },
          { key: "bucket", header: "Balance", hideBelowTablet: true, render: (transaction) => <span className={styles.muted}>{walletBalanceBucketLabels[transaction.balanceBucket]}</span> },
          { key: "reference", header: "Reference", hideBelowTablet: true, render: (transaction) => <span className={styles.muted}>{transaction.reference}</span> },
          { key: "amount", header: "Amount", align: "end", render: (transaction) => <span className={transaction.direction === "credit" ? styles.credit : styles.debit}>{transaction.direction === "credit" ? "+" : "−"}{formatMoney(transaction.amount)}</span> },
        ]}
      />
    </Panel>
  );
}

export function WalletOverviewView() {
  const { can } = useSellerSession();
  const balancesQuery = useSellerQuery<WalletBalances>("/seller/wallet/balances");
  const summaryQuery = useSellerQuery<FinanceSummary>("/seller/finance/summary");

  return (
    <PageStack>
      <PageHeader
        title="Payments & finance"
        description="Buyers pay into escrow when they order in the Zudomart app. Money moves to your available balance after delivery, then you withdraw it to your bank."
        actions={
          <>
            <ButtonLink href="/wallet/statements" iconName="export24">Statements</ButtonLink>
            {can("wallet:withdraw") ? <ButtonLink href="/wallet/withdraw" variant="primary" iconName="creditCard24">Withdraw</ButtonLink> : null}
          </>
        }
      />
      <WalletTabs />
      <PayoutSetupBanner />
      {balancesQuery.data ? <WalletBalanceCards balances={balancesQuery.data} /> : balancesQuery.errorMessage ? <ErrorCallout message={balancesQuery.errorMessage} onRetry={balancesQuery.reload} /> : <LoadingBlock label="Loading balances" />}
      <FinanceSummarySection summary={summaryQuery.data} isLoading={summaryQuery.isLoading} errorMessage={summaryQuery.errorMessage} onRetry={summaryQuery.reload} />
      <div className={styles.overviewGrid}>
        <WalletTransactionsPanel />
        <div className={styles.sideStack}>
          {summaryQuery.data ? <UpcomingEscrowReleasesPanel summary={summaryQuery.data} /> : null}
          <AccountingExportPanel />
        </div>
      </div>
    </PageStack>
  );
}
