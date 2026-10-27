"use client";

import { NanttyWordmark } from "@nantty/web-kit";
import Link from "next/link";

import { formatStatementMonthLabel, walletTransactionKindLabels } from "@/components/wallet/walletPresentation.constant";
import { Button } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { StatementDetail } from "@/types/finance.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./statementDocument.module.css";
import { IconLabel } from "@/components/ui/nanttyIcon";

export function StatementDocumentView({ month }: { readonly month: string }) {
  const { formatMoney, locale } = useMoneyFormatter();
  const statementQuery = useSellerQuery<StatementDetail>(`/seller/finance/statements/${encodeURIComponent(month)}`);
  const statement = statementQuery.data;
  return (
    <div className={styles.page}>
      <div className={`${styles.toolbar} noPrint`}>
        <Link href="/wallet/statements"><IconLabel name="arrowLeft24" size={16}>All statements</IconLabel></Link>
        <Button variant="primary" iconName="export24" onClick={() => window.print()} disabled={!statement}>
          Print or save as PDF
        </Button>
      </div>
      {statementQuery.errorMessage ? <Callout tone="error" action={<Button size="small" onClick={statementQuery.reload}>Try again</Button>}>{statementQuery.errorMessage}</Callout> : null}
      {!statement && statementQuery.isLoading ? <LoadingBlock label="Preparing statement" /> : null}
      {statement ? (
        <article className={styles.document} aria-label={`Statement for ${formatStatementMonthLabel(month, locale)}`}>
          <header className={styles.header}>
            <div>
              <div className={styles.brand}>
                <NanttyWordmark height={26} />
              </div>
              <h1 className={styles.title}>Wallet statement</h1>
              <p className={styles.muted}>{formatStatementMonthLabel(month, locale)}</p>
            </div>
            <div className={styles.storeBlock}>
              <strong>{statement.storeName}</strong>
              <span>{statement.storeAddress}</span>
              <span className={styles.muted}>Generated {formatDateTimeForDisplay(statement.generatedAt)}</span>
            </div>
          </header>
          <dl className={styles.summary}>
            <div><dt>Opening balance</dt><dd>{formatMoney(statement.summary.openingBalance)}</dd></div>
            <div><dt>Money in</dt><dd>+{formatMoney(statement.summary.credits)}</dd></div>
            <div><dt>Money out</dt><dd>−{formatMoney(statement.summary.debits)}</dd></div>
            <div><dt>Closing balance</dt><dd>{formatMoney(statement.summary.closingBalance)}</dd></div>
          </dl>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Description</th>
                <th scope="col">Type</th>
                <th scope="col" className={styles.numeric}>Amount</th>
                <th scope="col" className={styles.numeric}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {statement.lines.length === 0 ? (
                <tr><td colSpan={5} className={styles.muted}>No movements this month.</td></tr>
              ) : (
                statement.lines.map((line) => (
                  <tr key={line.id} className={line.balanceBucket === "available" ? undefined : styles.escrowLine}>
                    <td>{formatDateTimeForDisplay(line.createdAt)}</td>
                    <td>{line.description}<span className={styles.reference}>{line.reference}</span></td>
                    <td>{walletTransactionKindLabels[line.kind]}{line.balanceBucket === "available" ? "" : " (escrow)"}</td>
                    <td className={styles.numeric}>{line.direction === "credit" ? "+" : "−"}{formatMoney(line.amount)}</td>
                    <td className={styles.numeric}>{formatMoney(line.runningBalance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p className={styles.footnote}>Escrow lines are shown for reference and do not change your available balance until released. Amounts are in your store&apos;s currency.</p>
        </article>
      ) : null}
    </div>
  );
}
