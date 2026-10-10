"use client";

import { useState } from "react";

import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchLedgerAccounts, fetchLedgerCurrencies, fetchLedgerEntries } from "@/services/moneyApi.service";
import type { JournalEntry } from "@/types/ledger.type";
import { formatDateTime, formatMoneyForDisplay, humanizeConstantName } from "@/utils/formatting.util";

import ledgerStyles from "./ledger.module.css";
import styles from "./money.module.css";

function JournalEntryCard({ journal }: { readonly journal: JournalEntry }) {
  return (
    <article className={ledgerStyles.journal}>
      <header className={ledgerStyles.journalHeader}>
        <span className={styles.stack}>
          <strong>{journal.description}</strong>
          <span className={styles.muted}>
            <span className="mono">{journal.reference}</span> · {humanizeConstantName(journal.kind)} · {formatDateTime(journal.postedAt)}{journal.externalReference ? <> · <span className="mono">{journal.externalReference}</span></> : null}{journal.reversesEntryId ? <> · reverses <span className="mono">{journal.reversesEntryId}</span></> : null}
          </span>
        </span>
        {journal.isBalanced ? <StatusBadge label="Balanced" tone="success" /> : <StatusBadge label="Out of balance" tone="danger" />}
      </header>
      <table className={ledgerStyles.legs}>
        <caption className="visuallyHidden">Journal legs</caption>
        <tbody>
          {journal.legs.map((leg, index) => (
            <tr key={`${leg.accountCode}-${index}`}>
              <td>{leg.accountName} <span className={styles.muted}>{leg.accountCode}</span></td>
              <td>{leg.direction === "debit" ? formatMoneyForDisplay(leg.amount) : ""}</td>
              <td>{leg.direction === "credit" ? formatMoneyForDisplay(leg.amount) : ""}</td>
            </tr>
          ))}
          <tr>
            <td className={styles.muted}>Totals (debit / credit)</td>
            <td>{formatMoneyForDisplay(journal.totalDebits)}</td>
            <td>{formatMoneyForDisplay(journal.totalCredits)}</td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

function LedgerForCurrency({ currency }: { readonly currency: string }) {
  const [accountCode, setAccountCode] = useState<string | null>(null);
  const [accountCursor, setAccountCursor] = useState<string | undefined>();
  const [entryCursor, setEntryCursor] = useState<string | undefined>();
  const accountFilters = { currency, cursor: accountCursor };
  const accounts = useAdminQuery((signal) => fetchLedgerAccounts(accountFilters, signal), JSON.stringify(accountFilters));
  const entryFilters = { currency, accountCode: accountCode ?? undefined, cursor: entryCursor };
  const entries = useAdminQuery((signal) => fetchLedgerEntries(entryFilters, signal), JSON.stringify(entryFilters));

  function chooseAccount(code: string | null) {
    setAccountCode(code);
    setEntryCursor(undefined);
  }

  return (
    <div className={ledgerStyles.ledgerLayout}>
      <Card title={`Accounts · ${currency}`} isFlush>
        {accounts.errorMessage ? <ErrorBlock message={accounts.errorMessage} onRetry={accounts.reload} /> : null}
        {accounts.isLoading && !accounts.data ? <LoadingBlock /> : null}
        <button type="button" className={`${ledgerStyles.accountButton} ${accountCode === null ? ledgerStyles.accountButtonActive : ""}`} onClick={() => chooseAccount(null)} aria-pressed={accountCode === null}>
          <strong>All accounts</strong>
        </button>
        {accounts.data?.items.map((account) => (
          <button key={account.code} type="button" className={`${ledgerStyles.accountButton} ${accountCode === account.code ? ledgerStyles.accountButtonActive : ""}`} onClick={() => chooseAccount(account.code)} aria-pressed={accountCode === account.code}>
            <span className={styles.stack}>
              <strong>{account.name}</strong>
              <span className={styles.muted}>{humanizeConstantName(account.kind)} · {account.entryCount} legs{account.ownerId ? ` · ${account.ownerType ?? "owner"} ${account.ownerId}` : ""}</span>
            </span>
            <span className={styles.amount}>{formatMoneyForDisplay(account.balance)}</span>
          </button>
        ))}
        <div className={ledgerStyles.journal}><CursorPagination cursor={accountCursor} nextCursor={accounts.data?.nextCursor} onCursorChange={setAccountCursor} /></div>
      </Card>
      <Card title="Journal entries" isFlush>
        {entries.errorMessage ? <ErrorBlock message={entries.errorMessage} onRetry={entries.reload} /> : null}
        {entries.isLoading && !entries.data ? <LoadingBlock lines={6} /> : null}
        {entries.data?.items.map((journal) => <JournalEntryCard key={journal.id} journal={journal} />)}
        {entries.data && entries.data.items.length === 0 ? <p className={ledgerStyles.journal}>No entries for this account.</p> : null}
        <div className={ledgerStyles.journal}><CursorPagination cursor={entryCursor} nextCursor={entries.data?.nextCursor} onCursorChange={setEntryCursor} /></div>
      </Card>
    </div>
  );
}

export function LedgerWorkspace() {
  const currencies = useAdminQuery((signal) => fetchLedgerCurrencies(signal), "ledger-currencies");
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const currency = selectedCurrency ?? currencies.data?.items[0] ?? null;

  return (
    <>
      <PageHeader area="Money" title="Ledger" description="Read-only double-entry ledger, one currency at a time. Every journal must balance: total debits equal total credits." />
      {currencies.errorMessage ? <ErrorBlock message={currencies.errorMessage} onRetry={currencies.reload} /> : null}
      {currencies.data ? <SegmentedTabs label="Currency" items={currencies.data.items.map((code) => ({ key: code, label: code }))} activeKey={currency ?? ""} onChange={setSelectedCurrency} /> : null}
      {currency ? <LedgerForCurrency key={currency} currency={currency} /> : currencies.isLoading ? <LoadingBlock /> : null}
    </>
  );
}
