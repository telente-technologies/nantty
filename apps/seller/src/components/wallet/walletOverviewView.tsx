"use client";

import { useState } from "react";

import { WalletBalanceCards } from "@/components/wallet/walletBalanceCards";
import { WalletTabs } from "@/components/wallet/walletTabs";
import { useWalletCursorPages } from "@/components/wallet/useWalletCursorPages.hook";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { DateRangeControl, FilterBar, type DateRangeValue } from "@/components/ui/filterControls";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { WalletBalances, WalletTransaction, WalletTransactionKind } from "@/types/wallet.type";
import { triggerBrowserDownload } from "@/utils/csvFile.util";
import { buildDateRangeEndingToday, formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./wallet.module.css";

export const walletTransactionKindLabels: Record<WalletTransactionKind, string> = {
  escrow_hold: "Held in escrow",
  escrow_release: "Escrow release",
  pos_settlement: "Register settlement",
  payout: "Payout",
  refund: "Refund",
  fee: "Fee",
  affiliate_commission: "Affiliate commission",
  ads_charge: "Ads",
  subscription_charge: "Gold subscription",
  adjustment: "Adjustment",
};

function readPreviousMonthValue(): string {
  const date = new Date();
  date.setUTCDate(1);
  return date.toISOString().slice(0, 7);
}

export function WalletOverviewView() {
  const { can } = useSellerSession();
  const { formatMoney } = useMoneyFormatter();
  const { showToast } = useToast();
  const balancesQuery = useSellerQuery<WalletBalances>("/seller/wallet/balances");
  const [kind, setKind] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => buildDateRangeEndingToday(90));
  const [statementMonth, setStatementMonth] = useState(readPreviousMonthValue);
  const [isDownloadingStatement, setIsDownloadingStatement] = useState(false);
  const transactions = useWalletCursorPages<WalletTransaction>("/seller/wallet/transactions", { kind, from: dateRange.from, to: dateRange.to, limit: 25 });

  async function downloadMonthlyStatement() {
    if (!/^\d{4}-\d{2}$/.test(statementMonth)) {
      showToast("Choose a month for the statement.", "error");
      return;
    }
    setIsDownloadingStatement(true);
    try {
      const statementBlob = await sendSellerApiRequest<Blob>("/seller/wallet/statements", { query: { month: statementMonth }, expect: "blob" });
      triggerBrowserDownload(`wallet-statement-${statementMonth}.csv`, statementBlob);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsDownloadingStatement(false);
    }
  }

  return (
    <PageStack>
      <PageHeader title="Wallet & payouts" description="Online order money moves from escrow to available after delivery. Register card and transfer takings settle here too." actions={can("wallet:withdraw") ? <ButtonLink href="/wallet/withdraw" variant="primary" iconName="creditCard24">Withdraw</ButtonLink> : null} />
      <WalletTabs />
      {balancesQuery.data ? <WalletBalanceCards balances={balancesQuery.data} /> : balancesQuery.errorMessage ? <Callout tone="error">{balancesQuery.errorMessage}</Callout> : <LoadingBlock label="Loading balances" />}
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
        {transactions.errorMessage ? <Callout tone="error" action={<Button size="small" onClick={transactions.reload}>Try again</Button>}>{transactions.errorMessage}</Callout> : null}
        <DataTable
          caption="Wallet transactions"
          rows={transactions.items}
          readRowKey={(transaction) => transaction.id}
          isLoading={transactions.isLoading}
          hasMore={transactions.hasMore}
          isLoadingMore={transactions.isLoadingMore}
          onLoadMore={() => void transactions.loadNextPage()}
          emptyState="No transactions match these filters."
          columns={[
            { key: "date", header: "Date", render: (transaction) => formatDateTimeForDisplay(transaction.createdAt) },
            { key: "description", header: "Description", render: (transaction) => transaction.description },
            { key: "kind", header: "Type", hideBelowTablet: true, render: (transaction) => <StatusBadge tone={transaction.direction === "credit" ? "success" : "neutral"}>{walletTransactionKindLabels[transaction.kind]}</StatusBadge> },
            { key: "bucket", header: "Balance", hideBelowTablet: true, render: (transaction) => <span className={styles.muted}>{transaction.balanceBucket}</span> },
            { key: "reference", header: "Reference", hideBelowTablet: true, render: (transaction) => <span className={styles.muted}>{transaction.reference}</span> },
            { key: "amount", header: "Amount", align: "end", render: (transaction) => <span className={transaction.direction === "credit" ? styles.credit : styles.debit}>{transaction.direction === "credit" ? "+" : "−"}{formatMoney(transaction.amount)}</span> },
          ]}
        />
      </Panel>
      <Panel title="Statements" description="Download every wallet movement for a month as a CSV file.">
        <div className={styles.statementRow}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontWeight: 600, fontSize: 13 }}>
            Month
            <input type="month" className={styles.monthInput} value={statementMonth} max={new Date().toISOString().slice(0, 7)} onChange={(event) => setStatementMonth(event.target.value)} />
          </label>
          <Button iconName="export24" onClick={() => void downloadMonthlyStatement()} isBusy={isDownloadingStatement}>
            Download statement
          </Button>
        </div>
      </Panel>
    </PageStack>
  );
}
