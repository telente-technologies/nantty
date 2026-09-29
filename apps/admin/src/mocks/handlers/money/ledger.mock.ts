import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { failValidation, paginateItems, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { JournalEntry, LedgerAccount } from "@/types/ledger.type";

import type { MockJournalRecord, MockLedgerAccountRecord } from "./moneyRecords.mock";
import { readMockMoneyStore } from "./moneyStore.mock";

function calculateAccountBalanceMinor(account: MockLedgerAccountRecord, journals: readonly MockJournalRecord[]): { balanceMinor: number; entryCount: number } {
  let debits = 0;
  let credits = 0;
  let entryCount = 0;
  for (const journal of journals) {
    for (const leg of journal.legs) {
      if (leg.accountId !== account.id) continue;
      entryCount += 1;
      if (leg.direction === "DEBIT") debits += leg.amountMinor;
      else credits += leg.amountMinor;
    }
  }
  const isDebitNormal = account.kind === "ASSET" || account.kind === "EXPENSE";
  return { balanceMinor: isDebitNormal ? debits - credits : credits - debits, entryCount };
}

function presentJournal(journal: MockJournalRecord): JournalEntry {
  const accounts = readMockMoneyStore().ledgerAccounts;
  const sumFor = (direction: "DEBIT" | "CREDIT") => journal.legs.filter((leg) => leg.direction === direction).reduce((sum, leg) => sum + leg.amountMinor, 0);
  const totalDebits = sumFor("DEBIT");
  const totalCredits = sumFor("CREDIT");
  return {
    id: journal.id,
    occurredAt: journal.occurredAt,
    description: journal.description,
    currency: journal.currency,
    reference: journal.reference,
    legs: journal.legs.map((leg) => ({ accountId: leg.accountId, accountName: accounts.get(leg.accountId)?.name ?? leg.accountId, direction: leg.direction, amount: { amountMinor: leg.amountMinor, currency: journal.currency } })),
    totalDebits: { amountMinor: totalDebits, currency: journal.currency },
    totalCredits: { amountMinor: totalCredits, currency: journal.currency },
    isBalanced: totalDebits === totalCredits,
  };
}

function readRequiredCurrency(request: MockRequest): string {
  const currency = request.query.get("currency") ?? "";
  if (!/^[A-Z]{3}$/.test(currency)) failValidation("currency", "Choose a currency.");
  return currency;
}

export function registerLedgerMockHandlers(): void {
  registerMockRoute("GET", "/admin/ledger/currencies", (request) => {
    requireMockPermission(request, "ledger:read");
    const currencies = [...new Set([...readMockMoneyStore().ledgerAccounts.values()].map((account) => account.currency))].sort((first, second) => (first === "NGN" ? -1 : second === "NGN" ? 1 : first.localeCompare(second)));
    return respondWithJson(200, { items: currencies });
  });

  registerMockRoute("GET", "/admin/ledger/accounts", (request) => {
    requireMockPermission(request, "ledger:read");
    const currency = readRequiredCurrency(request);
    const store = readMockMoneyStore();
    const accounts: LedgerAccount[] = [...store.ledgerAccounts.values()]
      .filter((account) => account.currency === currency)
      .map((account) => {
        const { balanceMinor, entryCount } = calculateAccountBalanceMinor(account, store.journals);
        return { ...account, balance: { amountMinor: balanceMinor, currency }, entryCount };
      })
      .sort((first, second) => Number(first.ownerUserId !== null) - Number(second.ownerUserId !== null) || first.name.localeCompare(second.name));
    return respondWithJson(200, { items: accounts });
  });

  registerMockRoute("GET", "/admin/ledger/entries", (request) => {
    requireMockPermission(request, "ledger:read");
    const currency = readRequiredCurrency(request);
    const accountId = request.query.get("accountId");
    const referenceId = request.query.get("referenceId");
    const journals = readMockMoneyStore()
      .journals.filter((journal) => journal.currency === currency && (!accountId || journal.legs.some((leg) => leg.accountId === accountId)) && (!referenceId || journal.reference.id === referenceId))
      .map(presentJournal);
    return respondWithJson(200, paginateItems(journals, request, 25));
  });
}
