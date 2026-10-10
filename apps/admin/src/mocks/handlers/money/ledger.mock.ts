import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { failValidation, paginateByCursor, respondWithJson } from "@/mocks/mockResponses.mock";
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
  const isDebitNormal = account.kind === "asset" || account.kind === "expense";
  return { balanceMinor: isDebitNormal ? debits - credits : credits - debits, entryCount };
}

function presentJournal(journal: MockJournalRecord): JournalEntry {
  const accounts = readMockMoneyStore().ledgerAccounts;
  const sumFor = (direction: "DEBIT" | "CREDIT") => journal.legs.filter((leg) => leg.direction === direction).reduce((sum, leg) => sum + leg.amountMinor, 0);
  const totalDebits = sumFor("DEBIT");
  const totalCredits = sumFor("CREDIT");
  return {
    id: journal.id,
    reference: `${journal.reference.type.toLowerCase()}:${journal.reference.id}`,
    externalReference: journal.reference.label,
    kind: `${journal.reference.type.toLowerCase()}.posted`,
    description: journal.description,
    reversesEntryId: null,
    postedAt: journal.occurredAt,
    legs: journal.legs.map((leg) => ({ accountCode: leg.accountId, accountName: accounts.get(leg.accountId)?.name ?? leg.accountId, direction: leg.direction === "DEBIT" ? "debit" : "credit", amount: { amountMinor: leg.amountMinor, currency: journal.currency } })),
    totalDebits: { amountMinor: totalDebits, currency: journal.currency },
    totalCredits: { amountMinor: totalCredits, currency: journal.currency },
    isBalanced: totalDebits === totalCredits,
  };
}

function readRequiredCurrency(request: MockRequest): string {
  const currency = request.query.get("currency") ?? "";
  if (!/^([A-Z]{3}|COIN)$/.test(currency)) failValidation("currency", "must be an ISO 4217 code or COIN");
  return currency;
}

export function registerLedgerMockHandlers(): void {
  registerMockRoute("GET", "/admin/ledger/currencies", (request) => {
    requireMockPermission(request, "ledger:read");
    const currencies = [...new Set([...readMockMoneyStore().ledgerAccounts.values()].map((account) => account.currency))].sort((first, second) => (first === "NGN" ? -1 : second === "NGN" ? 1 : first.localeCompare(second)));
    return respondWithJson(200, { items: currencies, nextCursor: null });
  });

  registerMockRoute("GET", "/admin/ledger/accounts", (request) => {
    requireMockPermission(request, "ledger:read");
    const currency = readRequiredCurrency(request);
    const store = readMockMoneyStore();
    const accounts: LedgerAccount[] = [...store.ledgerAccounts.values()]
      .filter((account) => account.currency === currency)
      .map((account) => {
        const { balanceMinor, entryCount } = calculateAccountBalanceMinor(account, store.journals);
        return { code: account.id, name: account.name, kind: account.kind, currency, balance: { amountMinor: balanceMinor, currency }, ownerType: account.ownerUserId ? "user" : null, ownerId: account.ownerUserId, entryCount };
      })
      .sort((first, second) => first.code.localeCompare(second.code));
    return respondWithJson(200, paginateByCursor(accounts, request, 20));
  });

  registerMockRoute("GET", "/admin/ledger/journal-entries", (request) => {
    requireMockPermission(request, "ledger:read");
    const currency = readRequiredCurrency(request);
    const accountCode = request.query.get("accountCode");
    const reference = request.query.get("reference");
    const journals = readMockMoneyStore()
      .journals.filter((journal) => journal.currency === currency && (!accountCode || journal.legs.some((leg) => leg.accountId === accountCode)))
      .map(presentJournal)
      .filter((journal) => !reference || journal.reference === reference);
    return respondWithJson(200, paginateByCursor(journals, request, 20));
  });
}
