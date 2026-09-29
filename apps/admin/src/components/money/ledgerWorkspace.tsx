"use client";

import { useState } from "react";

import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { Pagination } from "@/components/ui/pagination";
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
            <span className="mono">{journal.id}</span> · {humanizeConstantName(journal.reference.type)} {journal.reference.label} · {formatDateTime(journal.occurredAt)}
          </span>
        </span>
        {journal.isBalanced ? <StatusBadge label="Balanced" tone="success" /> : <StatusBadge label="Out of balance" tone="danger" />}
      </header>
      <table className={ledgerStyles.legs}>
        <caption className="visuallyHidden">Journal legs</caption>
        <tbody>
          {journal.legs.map((leg, index) => (
            <tr key={`${leg.accountId}-${index}`}>
              <td>{leg.accountName} <span className={styles.muted}>{leg.accountId}</span></td>
              <td>{leg.direction === "DEBIT" ? formatMoneyForDisplay(leg.amount) : ""}</td>
              <td>{leg.direction === "CREDIT" ? formatMoneyForDisplay(leg.amount) : ""}</td>
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
  const [accountId, setAccountId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const accounts = useAdminQuery((signal) => fetchLedgerAccounts(currency, signal), currency);
  const entryFilters = { currency, accountId: accountId ?? undefined, page };
  const entries = useAdminQuery((signal) => fetchLedgerEntries(entryFilters, signal), JSON.stringify(entryFilters));

  return (
    <div className={ledgerStyles.ledgerLayout}>
      <Card title={`Accounts · ${currency}`} isFlush>
        {accounts.errorMessage ? <ErrorBlock message={accounts.errorMessage} onRetry={accounts.reload} /> : null}
        {accounts.isLoading && !accounts.data ? <LoadingBlock /> : null}
        <button type="button" className={`${ledgerStyles.accountButton} ${accountId === null ? ledgerStyles.accountButtonActive : ""}`} onClick={() => { setAccountId(null); setPage(1); }} aria-pressed={accountId === null}>
          <strong>All accounts</strong>
        </button>
        {accounts.data?.items.map((account) => (
          <button key={account.id} type="button" className={`${ledgerStyles.accountButton} ${accountId === account.id ? ledgerStyles.accountButtonActive : ""}`} onClick={() => { setAccountId(account.id); setPage(1); }} aria-pressed={accountId === account.id}>
            <span className={styles.stack}>
              <strong>{account.name}</strong>
              <span className={styles.muted}>{humanizeConstantName(account.kind)} · {account.entryCount} legs</span>
            </span>
            <span className={styles.amount}>{formatMoneyForDisplay(account.balance)}</span>
          </button>
        ))}
      </Card>
      <Card title="Journal entries" isFlush>
        {entries.errorMessage ? <ErrorBlock message={entries.errorMessage} onRetry={entries.reload} /> : null}
        {entries.isLoading && !entries.data ? <LoadingBlock lines={6} /> : null}
        {entries.data?.items.map((journal) => <JournalEntryCard key={journal.id} journal={journal} />)}
        {entries.data && entries.data.items.length === 0 ? <p className={ledgerStyles.journal}>No entries for this account.</p> : null}
        {entries.data ? <div className={ledgerStyles.journal}><Pagination page={entries.data.page} pageSize={entries.data.pageSize} total={entries.data.total} onPageChange={setPage} /></div> : null}
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
