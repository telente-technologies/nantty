"use client";

import { useState } from "react";

import { formatStatementMonthLabel } from "@/components/wallet/walletPresentation.constant";
import { WalletTabs } from "@/components/wallet/walletTabs";
import { Button, ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { StatementMonthSummary } from "@/types/finance.type";
import type { CursorPage } from "@/types/pagination.type";
import { triggerBrowserDownload } from "@/utils/csvFile.util";

import styles from "./wallet.module.css";

export function StatementsView() {
  const { formatMoney, locale } = useMoneyFormatter();
  const { showToast } = useToast();
  const statementsQuery = useSellerQuery<CursorPage<StatementMonthSummary>>("/seller/finance/statements");
  const [downloadingMonth, setDownloadingMonth] = useState<string | null>(null);

  async function downloadStatementCsvForMonth(month: string) {
    setDownloadingMonth(month);
    try {
      const statementBlob = await sendSellerApiRequest<Blob>("/seller/wallet/statements", { query: { month }, expect: "blob" });
      triggerBrowserDownload(`wallet-statement-${month}.csv`, statementBlob);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setDownloadingMonth(null);
    }
  }

  return (
    <PageStack>
      <PageHeader title="Statements" description="A monthly statement of every movement on your available balance. Download a CSV for your spreadsheet or open the PDF to print or save." />
      <WalletTabs />
      <Panel padded={false}>
        <DataTable
          caption="Monthly statements"
          rows={statementsQuery.data?.data ?? null}
          readRowKey={(statement) => statement.month}
          isLoading={statementsQuery.isLoading}
          errorMessage={statementsQuery.errorMessage}
          onRetry={statementsQuery.reload}
          emptyState={<EmptyState iconName="textIndent24" title="No statements yet" />}
          columns={[
            { key: "month", header: "Month", render: (statement) => <span className={styles.primaryCell}><strong>{formatStatementMonthLabel(statement.month, locale)}</strong><span className={styles.muted}>{statement.transactionsCount} movements</span></span> },
            { key: "opening", header: "Opening", align: "end", hideBelowTablet: true, render: (statement) => formatMoney(statement.openingBalance) },
            { key: "credits", header: "Money in", align: "end", hideBelowTablet: true, render: (statement) => <span className={styles.credit}>+{formatMoney(statement.credits)}</span> },
            { key: "debits", header: "Money out", align: "end", hideBelowTablet: true, render: (statement) => `−${formatMoney(statement.debits)}` },
            { key: "closing", header: "Closing", align: "end", render: (statement) => <strong>{formatMoney(statement.closingBalance)}</strong> },
            {
              key: "actions",
              header: <span className="visuallyHidden">Download</span>,
              align: "end",
              render: (statement) => (
                <span className={styles.accountActions}>
                  <Button size="small" iconName="export24" isBusy={downloadingMonth === statement.month} onClick={() => void downloadStatementCsvForMonth(statement.month)}>
                    CSV
                  </Button>
                  <ButtonLink size="small" href={`/wallet/statements/${statement.month}`}>
                    PDF
                  </ButtonLink>
                </span>
              ),
            },
          ]}
        />
      </Panel>
    </PageStack>
  );
}
