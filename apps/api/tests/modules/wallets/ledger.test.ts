import { describe, expect, it } from "vitest";

import type { CurrencyCode } from "../../../src/enums/currency.enum.js";
import { calculateBalanceChange, type LedgerTransactionInput } from "../../../src/modules/wallets/models/wallets.model.js";
import { InMemoryLedgerRepository } from "../../../src/modules/wallets/repositories/ledger.repository.js";
import { buildLinesMovingMoneyBetweenCurrencies, LedgerAccounts, LedgerService } from "../../../src/modules/wallets/services/ledger.service.js";
import { Money } from "../../../src/utils/money.util.js";

const clock = { now: () => new Date("2026-09-01T10:00:00.000Z") };

function createLedger() {
  const repository = new InMemoryLedgerRepository();
  return { repository, ledger: new LedgerService(repository, clock) };
}

function fundWallet(storeId: string, amount: number, reference: string, currency: CurrencyCode = "NGN"): LedgerTransactionInput {
  return {
    reference,
    kind: "test_funding",
    description: "Funding",
    lines: [
      { account: LedgerAccounts.providerClearing("paystack", currency), direction: "debit", amount, currency },
      { account: LedgerAccounts.storeWallet(storeId, currency), direction: "credit", amount, currency },
    ],
  };
}

function withdraw(storeId: string, amount: number, reference: string, currency: CurrencyCode = "NGN"): LedgerTransactionInput {
  return {
    reference,
    kind: "test_withdrawal",
    description: "Withdrawal",
    lines: [
      { account: LedgerAccounts.storeWallet(storeId, currency), direction: "debit", amount, currency },
      { account: LedgerAccounts.storePayoutPending(storeId, currency), direction: "credit", amount, currency },
    ],
  };
}

function assertLedgerInvariantsInEveryCurrency(repository: InMemoryLedgerRepository): void {
  const accounts = repository.listAllAccounts();
  const allEntries = repository.listAllTransactions().flatMap((transaction) => transaction.entries);
  for (const transaction of repository.listAllTransactions()) {
    for (const currency of new Set(transaction.entries.map((entry) => entry.currency))) {
      const sumFor = (direction: string) =>
        transaction.entries.filter((entry) => entry.currency === currency && entry.direction === direction).reduce((total, entry) => total + entry.amount, 0);
      expect(sumFor("debit")).toBe(sumFor("credit"));
    }
  }
  for (const account of accounts) {
    const entries = allEntries.filter((entry) => entry.accountId === account.id);
    expect(entries.every((entry) => entry.currency === account.currency)).toBe(true);
    expect(entries.reduce((total, entry) => total + calculateBalanceChange(account.kind, entry.direction, entry.amount), 0)).toBe(account.balance);
    if (!account.allowNegative) expect(account.balance).toBeGreaterThanOrEqual(0);
  }
  for (const currency of new Set(accounts.map((account) => account.currency))) {
    const inCurrency = accounts.filter((account) => account.currency === currency);
    const assets = inCurrency.filter((account) => account.kind === "asset").reduce((total, account) => total + account.balance, 0);
    const claims = inCurrency.filter((account) => account.kind !== "asset").reduce((total, account) => total + account.balance, 0);
    expect(assets).toBe(claims);
  }
}

describe("ledger service", () => {
  it("rejects unbalanced, empty and non-positive transactions", async () => {
    const { ledger } = createLedger();
    const funding = fundWallet("store-a", 500, "bad-1");
    await expect(ledger.postLedgerTransaction({ ...funding, lines: [funding.lines[0]!, { ...funding.lines[1]!, amount: 499 }] })).rejects.toThrow(/equal in NGN/);
    await expect(ledger.postLedgerTransaction({ ...funding, lines: [funding.lines[0]!] })).rejects.toThrow(/two lines/);
    await expect(ledger.postLedgerTransaction(fundWallet("store-a", 0, "bad-2"))).rejects.toThrow(/positive/);
    await expect(ledger.postLedgerTransaction(fundWallet("store-a", 10.5, "bad-3"))).rejects.toThrow(/positive/);
  });

  it("requires every currency to balance on its own", async () => {
    const { ledger } = createLedger();
    const crossCurrencyWithoutBridge: LedgerTransactionInput = {
      reference: "cross-1",
      kind: "test",
      description: "Dollars in, naira out without an exchange leg",
      lines: [
        { account: LedgerAccounts.providerClearing("paystack", "USD"), direction: "debit", amount: 1_000, currency: "USD" },
        { account: LedgerAccounts.storeWallet("store-x", "NGN"), direction: "credit", amount: 1_000, currency: "NGN" },
      ],
    };
    await expect(ledger.postLedgerTransaction(crossCurrencyWithoutBridge)).rejects.toThrow(/equal in USD/);
  });

  it("moves money between currencies through foreign-exchange position accounts", async () => {
    const { ledger, repository } = createLedger();
    const lines = buildLinesMovingMoneyBetweenCurrencies(
      LedgerAccounts.providerClearing("paystack", "USD"),
      Money.of(1_000, "USD"),
      LedgerAccounts.storeWallet("store-y", "NGN"),
      Money.of(1_500_000, "NGN"),
    );
    expect(lines).toHaveLength(4);
    await ledger.postLedgerTransaction({ reference: "fx-1", kind: "test", description: "FX", lines });
    expect(await ledger.readAccountBalance(LedgerAccounts.storeWallet("store-y", "NGN"))).toBe(1_500_000);
    expect(await ledger.readAccountBalance(LedgerAccounts.foreignExchangePosition("USD"))).toBe(-1_000);
    assertLedgerInvariantsInEveryCurrency(repository);
  });

  it("refuses a line whose currency differs from the account's currency", async () => {
    const { ledger } = createLedger();
    await ledger.postLedgerTransaction(fundWallet("store-z", 100, "fund-z"));
    const wrongCurrency: LedgerTransactionInput = {
      reference: "wrong-currency",
      kind: "test",
      description: "Mismatch",
      lines: [
        { account: LedgerAccounts.storeWallet("store-z", "NGN"), direction: "debit", amount: 50, currency: "USD" },
        { account: LedgerAccounts.storePayoutPending("store-z", "USD"), direction: "credit", amount: 50, currency: "USD" },
      ],
    };
    await expect(ledger.postLedgerTransaction(wrongCurrency)).rejects.toThrow(/Cannot combine/);
  });

  it("is idempotent by reference", async () => {
    const { ledger, repository } = createLedger();
    const first = await ledger.postLedgerTransaction(fundWallet("store-b", 1_000, "fund-b"));
    const second = await ledger.postLedgerTransaction(fundWallet("store-b", 1_000, "fund-b"));
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.transaction.id).toBe(first.transaction.id);
    expect(await ledger.readAccountBalance(LedgerAccounts.storeWallet("store-b", "NGN"))).toBe(1_000);
    assertLedgerInvariantsInEveryCurrency(repository);
  });

  it("rejects an overdraft without applying any line", async () => {
    const { ledger, repository } = createLedger();
    await ledger.postLedgerTransaction(fundWallet("store-c", 300, "fund-c"));
    await expect(ledger.postLedgerTransaction(withdraw("store-c", 301, "withdraw-c"))).rejects.toThrow(/Insufficient/);
    expect(await ledger.readAccountBalance(LedgerAccounts.storeWallet("store-c", "NGN"))).toBe(300);
    expect(await ledger.readAccountBalance(LedgerAccounts.storePayoutPending("store-c", "NGN"))).toBe(0);
    expect(await repository.findTransactionByReference("withdraw-c")).toBeUndefined();
    assertLedgerInvariantsInEveryCurrency(repository);
  });

  it("never lets concurrent withdrawals overdraw a wallet", async () => {
    const { ledger, repository } = createLedger();
    await ledger.postLedgerTransaction(fundWallet("store-d", 100, "fund-d", "GHS"));
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, index) => ledger.postLedgerTransaction(withdraw("store-d", 30, `withdraw-d-${index}`, "GHS"))));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    expect(await ledger.readAccountBalance(LedgerAccounts.storeWallet("store-d", "GHS"))).toBe(10);
    expect(await ledger.readAccountBalance(LedgerAccounts.storePayoutPending("store-d", "GHS"))).toBe(90);
    assertLedgerInvariantsInEveryCurrency(repository);
  });
});
