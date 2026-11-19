import { randomBytes } from "node:crypto";

import { doesRoleHavePermission } from "@/config/rolePermissions.config";
import { readPayoutAccountNumberRuleForCountry } from "@/constants/walletBankRules.constant";
import { appendMockAuditLogEntry, readGlobalMockSlice, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { runOnceForIdempotencyKey } from "@/mocks/mockIdempotency.mock";
import { MockHttpError, paginateMockList, readJsonObjectBody, requireMockStorePrincipal, respondWithCsv, respondWithJson, respondWithNoContent, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { convertIsoToStoreDateKey } from "@/mocks/handlers/reportSalesRecords.mock";
import type { WalletBank } from "@/types/walletExtra.type";
import type { Payout, WalletTransaction } from "@/types/wallet.type";
import { convertRowsToCsvText } from "@/utils/csvFile.util";
import { convertMinorUnitsToMajorInputText, formatMoneyForDisplay } from "@/utils/money.util";

const banksByCountry: Record<string, WalletBank[]> = {
  NG: [
    { code: "044", name: "Access Bank" }, { code: "058", name: "Guaranty Trust Bank" }, { code: "011", name: "First Bank of Nigeria" }, { code: "033", name: "United Bank for Africa" },
    { code: "057", name: "Zenith Bank" }, { code: "070", name: "Fidelity Bank" }, { code: "232", name: "Sterling Bank" }, { code: "50515", name: "Moniepoint MFB" },
    { code: "999992", name: "OPay" }, { code: "999991", name: "PalmPay" }, { code: "50211", name: "Kuda Bank" }, { code: "101", name: "Providus Bank" },
  ],
  GH: [{ code: "GCB", name: "GCB Bank" }, { code: "ECO", name: "Ecobank Ghana" }, { code: "STB", name: "Stanbic Bank Ghana" }],
  KE: [{ code: "01", name: "KCB Bank" }, { code: "68", name: "Equity Bank" }, { code: "11", name: "Co-operative Bank" }],
  ZA: [{ code: "632005", name: "ABSA" }, { code: "250655", name: "FNB" }, { code: "051001", name: "Standard Bank" }],
};

interface PendingAccountResolution {
  readonly bankCode: string;
  readonly bankName: string;
  readonly accountNameMasked: string;
  readonly accountNumberMasked: string;
  readonly expiresAtEpochMs: number;
}

function readPendingResolutions(): Map<string, PendingAccountResolution> {
  return readGlobalMockSlice("walletAccountResolutions", () => new Map<string, PendingAccountResolution>());
}

function requireWithdrawPermission(request: MockRequest) {
  const principal = requireMockStorePrincipal(request);
  if (!doesRoleHavePermission(principal.role, "wallet:withdraw")) throw new MockHttpError(403, "FORBIDDEN", "Only the store owner can move money out of the wallet.");
  return principal;
}

function maskAccountNumber(accountNumber: string): string {
  return `${"*".repeat(Math.max(accountNumber.length - 4, 0))}${accountNumber.slice(-4)}`;
}

function maskAccountName(accountName: string): string {
  return accountName.split(" ").map((word) => (word.length <= 3 ? word : `${word.slice(0, 3)}${"*".repeat(Math.min(word.length - 3, 4))}`)).join(" ");
}

function readPayoutSettings() {
  const currency = readMockDatabase().settings.currency;
  return { minimumPayout: { amountMinor: 100_000, currency }, fee: { amountMinor: 5_000, currency }, schedule: "Payouts reach your bank within 24 hours on working days." };
}

function listFilteredTransactions(query: URLSearchParams): WalletTransaction[] {
  const database = readMockDatabase();
  const kind = query.get("kind");
  const fromKey = query.get("from");
  const toKey = query.get("to");
  return [...database.wallet.transactions]
    .filter((transaction) => !kind || transaction.kind === kind)
    .filter((transaction) => {
      const dateKey = convertIsoToStoreDateKey(transaction.createdAt, database.settings.timezone);
      return (!fromKey || dateKey >= fromKey) && (!toKey || dateKey <= toKey);
    })
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

export function registerWalletMockHandlers(): void {
  registerMockRoute("GET", "/seller/wallet/balances", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, readMockDatabase().wallet.balances);
  });

  registerMockRoute("GET", "/seller/wallet/transactions", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, paginateMockList(listFilteredTransactions(request.query), request.query));
  });

  registerMockRoute("GET", "/seller/wallet/statements", (request) => {
    requireMockStorePrincipal(request);
    const month = request.query.get("month") ?? "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return respondWithValidationFailure([{ path: "month", message: "Choose a month in the format YYYY-MM." }]);
    const database = readMockDatabase();
    const currency = database.settings.currency;
    const monthTransactions = listFilteredTransactions(new URLSearchParams()).filter((transaction) => convertIsoToStoreDateKey(transaction.createdAt, database.settings.timezone).startsWith(month)).reverse();
    const csvText = convertRowsToCsvText(
      ["Date", "Description", "Reference", "Type", "Balance", "Direction", `Amount (${currency})`],
      monthTransactions.map((transaction) => [transaction.createdAt, transaction.description, transaction.reference, transaction.kind, transaction.balanceBucket, transaction.direction, `${transaction.direction === "debit" ? "-" : ""}${convertMinorUnitsToMajorInputText(transaction.amount.amountMinor, transaction.amount.currency)}`]),
    );
    return respondWithCsv(`wallet-statement-${month}.csv`, csvText);
  });

  registerMockRoute("GET", "/seller/wallet/payout-settings", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, readPayoutSettings());
  });

  registerMockRoute("GET", "/seller/wallet/payouts", (request) => {
    requireMockStorePrincipal(request);
    const payouts = [...readMockDatabase().wallet.payouts].sort((first, second) => second.requestedAt.localeCompare(first.requestedAt));
    return respondWithJson(200, paginateMockList(payouts, request.query));
  });

  registerMockRoute("POST", "/seller/wallet/payouts", (request) =>
    runOnceForIdempotencyKey(request, () => {
      const principal = requireWithdrawPermission(request);
      const body = readJsonObjectBody(request);
      const database = readMockDatabase();
      const settings = readPayoutSettings();
      const amountMinor = body.amountMinor;
      const account = database.wallet.payoutAccounts.find((candidate) => candidate.id === body.accountId);
      const issues: { path: string; message: string }[] = [];
      if (typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) issues.push({ path: "amountMinor", message: "Enter an amount to withdraw." });
      else if (amountMinor < settings.minimumPayout.amountMinor) issues.push({ path: "amountMinor", message: `The minimum payout is ${formatMoneyForDisplay(settings.minimumPayout)}.` });
      if (!account) issues.push({ path: "accountId", message: "Choose one of your payout accounts." });
      if (issues.length > 0 || typeof amountMinor !== "number" || !account) return respondWithValidationFailure(issues);
      const available = database.wallet.balances.available;
      if (amountMinor + settings.fee.amountMinor > available.amountMinor) throw new MockHttpError(422, "INSUFFICIENT_AVAILABLE_BALANCE", `You can withdraw up to ${formatMoneyForDisplay({ amountMinor: Math.max(0, available.amountMinor - settings.fee.amountMinor), currency: available.currency })} after the fee.`);
      const now = new Date().toISOString();
      const reference = `PYT-${randomBytes(4).toString("hex").toUpperCase()}`;
      const payout: Payout = { id: `pyt_${randomBytes(6).toString("hex")}`, amount: { amountMinor, currency: available.currency }, fee: settings.fee, accountId: account.id, accountSummary: `${account.bankName} ${account.accountNumberMasked}`, status: "processing", reference, requestedAt: now, completedAt: null };
      database.wallet.balances = { ...database.wallet.balances, available: { amountMinor: available.amountMinor - amountMinor - settings.fee.amountMinor, currency: available.currency } };
      database.wallet.payouts.unshift(payout);
      database.wallet.transactions.unshift(
        { id: `wtx_${randomBytes(6).toString("hex")}`, kind: "payout", description: `Payout to ${payout.accountSummary}`, amount: payout.amount, direction: "debit", balanceBucket: "available", reference, createdAt: now },
        { id: `wtx_${randomBytes(6).toString("hex")}`, kind: "fee", description: "Payout fee", amount: settings.fee, direction: "debit", balanceBucket: "available", reference, createdAt: now },
      );
      appendMockAuditLogEntry({ actor: { id: principal.staffId ?? principal.userId, name: principal.actorName, role: principal.role ?? "owner" }, action: "payout.requested", targetType: "payout", targetId: payout.id, summary: `Withdrew ${formatMoneyForDisplay(payout.amount)} to ${payout.accountSummary}` });
      return respondWithJson(201, payout);
    }),
  );

  registerMockRoute("GET", "/seller/wallet/banks", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, { data: banksByCountry[readMockDatabase().settings.country] ?? [], nextCursor: null });
  });

  registerMockRoute("GET", "/seller/wallet/banks/:bankCode/branches", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, { data: [], nextCursor: null });
  });

  registerMockRoute("GET", "/seller/wallet/payout-accounts", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, { data: readMockDatabase().wallet.payoutAccounts, nextCursor: null });
  });

  registerMockRoute("POST", "/seller/wallet/payout-accounts/resolve", (request) => {
    requireWithdrawPermission(request);
    const body = readJsonObjectBody(request);
    const database = readMockDatabase();
    const bank = (banksByCountry[database.settings.country] ?? []).find((candidate) => candidate.code === body.bankCode);
    const accountNumber = typeof body.accountNumber === "string" ? body.accountNumber.trim() : "";
    const rule = readPayoutAccountNumberRuleForCountry(database.settings.country);
    const issues: { path: string; message: string }[] = [];
    if (!bank) issues.push({ path: "bankCode", message: "Choose your bank." });
    if (!rule.pattern.test(accountNumber)) issues.push({ path: "accountNumber", message: `Enter a valid account number (${rule.hint}).` });
    if (issues.length > 0 || !bank) return respondWithValidationFailure(issues);
    if (accountNumber.endsWith("0000")) throw new MockHttpError(422, "ACCOUNT_NOT_RESOLVED", "The bank could not find this account. Check the number and bank.");
    const resolutionId = `res_${randomBytes(8).toString("hex")}`;
    const resolution: PendingAccountResolution = { bankCode: bank.code, bankName: bank.name, accountNameMasked: maskAccountName(database.settings.name.toUpperCase()), accountNumberMasked: maskAccountNumber(accountNumber), expiresAtEpochMs: Date.now() + 10 * 60_000 };
    readPendingResolutions().set(resolutionId, resolution);
    return respondWithJson(200, { resolutionId, bankCode: bank.code, bankName: bank.name, accountNameMasked: resolution.accountNameMasked, accountNumberMasked: resolution.accountNumberMasked });
  });

  registerMockRoute("POST", "/seller/wallet/payout-accounts", (request) =>
    runOnceForIdempotencyKey(request, () => {
      const principal = requireWithdrawPermission(request);
      const resolutionId = String(readJsonObjectBody(request).resolutionId ?? "");
      const resolution = readPendingResolutions().get(resolutionId);
      if (!resolution || resolution.expiresAtEpochMs < Date.now()) throw new MockHttpError(422, "RESOLUTION_EXPIRED", "Confirm the account name again before saving.");
      readPendingResolutions().delete(resolutionId);
      const wallet = readMockDatabase().wallet;
      if (wallet.payoutAccounts.some((account) => account.bankCode === resolution.bankCode && account.accountNumberMasked === resolution.accountNumberMasked)) throw new MockHttpError(409, "ACCOUNT_EXISTS", "This account is already saved.");
      const account = { id: `pac_${randomBytes(6).toString("hex")}`, bankName: resolution.bankName, bankCode: resolution.bankCode, accountNameMasked: resolution.accountNameMasked, accountNumberMasked: resolution.accountNumberMasked, isDefault: wallet.payoutAccounts.length === 0, verified: true };
      wallet.payoutAccounts.push(account);
      appendMockAuditLogEntry({ actor: { id: principal.staffId ?? principal.userId, name: principal.actorName, role: principal.role ?? "owner" }, action: "payout_account.added", targetType: "payout_account", targetId: account.id, summary: `Added payout account ${account.bankName} ${account.accountNumberMasked}` });
      return respondWithJson(201, account);
    }),
  );

  registerMockRoute("PATCH", "/seller/wallet/payout-accounts/:accountId", (request) => {
    requireWithdrawPermission(request);
    const wallet = readMockDatabase().wallet;
    if (readJsonObjectBody(request).isDefault !== true) return respondWithValidationFailure([{ path: "isDefault", message: "Only making an account the default is supported." }]);
    if (!wallet.payoutAccounts.some((account) => account.id === request.params.accountId)) throw new MockHttpError(404, "ACCOUNT_NOT_FOUND", "Payout account not found.");
    wallet.payoutAccounts = wallet.payoutAccounts.map((account) => ({ ...account, isDefault: account.id === request.params.accountId }));
    return respondWithJson(200, wallet.payoutAccounts.find((account) => account.id === request.params.accountId));
  });

  registerMockRoute("DELETE", "/seller/wallet/payout-accounts/:accountId", (request) => {
    const principal = requireWithdrawPermission(request);
    const wallet = readMockDatabase().wallet;
    const account = wallet.payoutAccounts.find((candidate) => candidate.id === request.params.accountId);
    if (!account) throw new MockHttpError(404, "ACCOUNT_NOT_FOUND", "Payout account not found.");
    if (account.isDefault && wallet.payoutAccounts.length > 1) throw new MockHttpError(409, "DEFAULT_ACCOUNT", "Make another account the default before removing this one.");
    if (wallet.payouts.some((payout) => payout.accountId === account.id && payout.status === "processing")) throw new MockHttpError(409, "PAYOUT_IN_PROGRESS", "A payout to this account is still processing.");
    wallet.payoutAccounts = wallet.payoutAccounts.filter((candidate) => candidate.id !== account.id);
    appendMockAuditLogEntry({ actor: { id: principal.staffId ?? principal.userId, name: principal.actorName, role: principal.role ?? "owner" }, action: "payout_account.removed", targetType: "payout_account", targetId: account.id, summary: `Removed payout account ${account.bankName} ${account.accountNumberMasked}` });
    return respondWithNoContent();
  });
}
