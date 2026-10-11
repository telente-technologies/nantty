"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { billingApi } from "@/services/billingApi.service";
import { readErrorMessageForDisplay, saveBlobAsDownloadedFile } from "@/services/adsApiClient.service";
import type { BillingTransaction, BillingTransactionType, Invoice } from "@/types/billing.type";
import { formatDateAndTime, formatDateWithYear, formatShortDate } from "@/utils/dateRange.util";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./billingPage.module.css";

const transactionTypeLabels: Record<BillingTransactionType, string> = {
  top_up: "Top-up",
  ad_spend: "Ad delivery",
  credit_grant: "Ad credit added",
  credit_spend: "Ad credit used",
  refund: "Refund",
  card_charge: "Card charge",
  ad_spend_debt: "Unpaid ad delivery",
};

export function BillingHistoryTables({ accountId }: { readonly accountId: string }) {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const transactionsQuery = useAdsQuery(async () => {
    const page = await billingApi.listTransactions(accountId);
    setTransactions([...page.items]);
    setNextCursor(page.nextCursor);
    return page;
  }, accountId);
  const invoicesQuery = useAdsQuery(() => billingApi.listInvoices(accountId), accountId);

  async function loadMoreTransactions() {
    setIsLoadingMore(true);
    try {
      const page = await billingApi.listTransactions(accountId, nextCursor);
      setTransactions((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function downloadFile(download: () => Promise<Blob>, fileName: string) {
    try {
      saveBlobAsDownloadedFile(await download(), fileName);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    }
  }

  const transactionColumns: DataTableColumn<BillingTransaction>[] = [
    { key: "date", header: "Date", render: (row) => formatDateAndTime(row.createdAt), sortValue: (row) => row.createdAt, isAlwaysVisible: true },
    { key: "type", header: "Type", render: (row) => transactionTypeLabels[row.type] },
    { key: "description", header: "Description", render: (row) => row.description },
    { key: "reference", header: "Reference", render: (row) => <span className={styles.muted}>{row.reference}</span> },
    { key: "amount", header: "Amount", align: "end", render: (row) => <span className={row.amount.amountMinor > 0 ? styles.positive : undefined}>{row.amount.amountMinor > 0 ? "+" : ""}{formatMoneyForDisplay(row.amount)}</span>, sortValue: (row) => row.amount.amountMinor },
    {
      key: "receipt",
      header: "Receipt",
      render: (row) =>
        row.receiptAvailable ? (
          <Button size="small" variant="ghost" iconName="boxArrowDown24" onClick={() => downloadFile(() => billingApi.downloadReceipt(accountId, row.id), `receipt-${row.reference}.txt`)}>
            Download
          </Button>
        ) : null,
    },
  ];

  const invoiceColumns: DataTableColumn<Invoice>[] = [
    { key: "number", header: "Invoice", render: (row) => <strong>{row.number}</strong>, isAlwaysVisible: true },
    { key: "period", header: "Period", render: (row) => `${formatShortDate(row.periodStart)} – ${formatDateWithYear(row.periodEnd)}` },
    { key: "subtotal", header: "Subtotal", align: "end", render: (row) => formatMoneyForDisplay(row.subtotal) },
    { key: "tax", header: "VAT", align: "end", render: (row) => formatMoneyForDisplay(row.tax) },
    { key: "total", header: "Total", align: "end", render: (row) => <strong>{formatMoneyForDisplay(row.total)}</strong>, sortValue: (row) => row.total.amountMinor },
    { key: "status", header: "Status", render: (row) => <StatusBadge tone={row.status === "paid" ? "success" : row.status === "open" ? "caution" : "neutral"}>{row.status === "paid" ? "Paid" : row.status === "open" ? "Open" : "Void"}</StatusBadge> },
    {
      key: "download",
      header: "File",
      render: (row) => (
        <Button size="small" variant="ghost" iconName="boxArrowDown24" onClick={() => downloadFile(() => billingApi.downloadInvoice(accountId, row.id), `${row.number}.txt`)}>
          Download
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card title="Transactions" description="Top-ups, daily delivery charges and credits." padded={false}>
        {transactionsQuery.errorMessage ? <ErrorState message={transactionsQuery.errorMessage} onRetry={transactionsQuery.reload} /> : null}
        {transactionsQuery.isLoading && transactions.length === 0 ? <LoadingBlock /> : <DataTable caption="Billing transactions" columns={transactionColumns} rows={transactions} readRowId={(row) => row.id} emptyState="No transactions yet." />}
        {nextCursor ? (
          <div style={{ padding: 12, display: "flex", justifyContent: "center" }}>
            <Button size="small" isLoading={isLoadingMore} onClick={loadMoreTransactions}>
              Load more
            </Button>
          </div>
        ) : null}
      </Card>
      <Card title="Invoices" description="Monthly tax invoices for delivered ads." padded={false}>
        {invoicesQuery.errorMessage ? <ErrorState message={invoicesQuery.errorMessage} onRetry={invoicesQuery.reload} /> : null}
        {invoicesQuery.isLoading ? <LoadingBlock /> : <DataTable caption="Invoices" columns={invoiceColumns} rows={invoicesQuery.data?.items ?? []} readRowId={(row) => row.id} emptyState="Invoices appear after your first full month of delivery." />}
      </Card>
    </>
  );
}
