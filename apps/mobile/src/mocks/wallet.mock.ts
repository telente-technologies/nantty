import { ApiError } from "@/errors/api.error";
import type { PayoutAccountInput, WithdrawalRequest } from "@/types/account.type";
import type { Money, PayoutAccount, WalletSummary, WalletTransaction } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import { bankNameForCode } from "./banks.mock";
import { readMockCoinBalance, readMockEarnedCoins } from "./coins.mock";
import { creatorEarningRecords, creatorEarningsUsdCentsByStatus, signedInUserIsApprovedCreator } from "./creatorFixtures.mock";
import { buildEscrowHoldFromRecord } from "./escrowBuilders.mock";
import { getSignedInMockUser, isoDateHoursAgo } from "./fixtures.mock";
import { convertUsdCentsToViewerCurrency, convertViewerMoneyToUsdCents } from "./locale.mock";
import { mockOrderRecords, sellerPayoutUsdCentsForOrderRecord } from "./orderFixtures.mock";
import { signedInUserCanWithdraw } from "./payoutOnboarding.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

interface MockWithdrawal {
  readonly id: string;
  readonly usdCents: number;
  readonly description: string;
  readonly createdAt: string;
  readonly status: WalletTransaction["status"];
  readonly userId: string;
}

const HELD_ORDER_STATUSES = new Set(["paid", "shipped", "delivered", "disputed"]);
const SAFETY_HOLD_MS = 24 * 3_600_000;
const MOCK_AD_CREDIT_USD_CENTS = 1_500;
const MOCK_DEBT_USD_CENTS = 0;

const withdrawals: MockWithdrawal[] = [
  { id: "wd_1", usdCents: 12_000, description: "Withdrawal to Guaranty Trust Bank ••••4821", createdAt: isoDateHoursAgo(200), status: "completed", userId: "u_me" },
];

const payoutAccountsByUserId = new Map<string, PayoutAccount[]>([
  ["u_me", [{ id: "pa_1", bankName: "Guaranty Trust Bank", accountNumberMasked: "••••4821", accountName: "TEMITOPE ADEYEMI" }]],
]);

const signedInStoreRecords = () => mockOrderRecords.filter((record) => record.storeId === getSignedInMockUser().storeId);
const myWithdrawals = () => withdrawals.filter((withdrawal) => withdrawal.userId === getSignedInMockUser().id);
const myPayoutAccounts = () => payoutAccountsByUserId.get(getSignedInMockUser().id) ?? [];

function computeWalletBalancesInUsdCents() {
  const released = signedInStoreRecords().filter((record) => record.status === "completed");
  const inSafetyHold = (releasedAt: string | null) => !!releasedAt && Date.now() - Date.parse(releasedAt) < SAFETY_HOLD_MS;
  const held = signedInStoreRecords().filter((record) => HELD_ORDER_STATUSES.has(record.status));
  const creator = creatorEarningsUsdCentsByStatus();
  const withdrawn = myWithdrawals().filter((w) => w.status !== "failed").reduce((sum, w) => sum + w.usdCents, 0);
  const payout = (records: typeof released) => records.reduce((sum, record) => sum + sellerPayoutUsdCentsForOrderRecord(record), 0);
  return {
    available: payout(released.filter((record) => !inSafetyHold(record.releasedAt))) + creator.availableUsdCents - withdrawn - MOCK_DEBT_USD_CENTS,
    pending: payout(held),
    locked: payout(released.filter((record) => inSafetyHold(record.releasedAt))),
    earningsPayable: creator.pendingUsdCents,
  };
}

const buildWalletSummary = (): WalletSummary => {
  const balances = computeWalletBalancesInUsdCents();
  const money = (usdCents: number) => convertUsdCentsToViewerCurrency(Math.max(0, usdCents));
  const available = money(balances.available);
  const pending = money(balances.pending);
  const locked = money(balances.locked);
  const earningsPayable = money(balances.earningsPayable);
  const adCredit = money(MOCK_AD_CREDIT_USD_CENTS);
  const debts = money(MOCK_DEBT_USD_CENTS);
  const coins = { spendable: readMockCoinBalance(), earned: readMockEarnedCoins() };
  const unlocked = signedInUserCanWithdraw();
  const zero: Money = { amountMinor: 0, currency: available.currency };
  return {
    available,
    pending,
    locked,
    inEscrow: pending,
    payoutRequested: zero,
    negativeBalance: zero,
    nextAvailableAt: null,
    adCredit,
    earningsPayable,
    debts,
    coins,
    lines: [
      { key: "available", label: "Available to withdraw", description: "Sales and creator earnings you can withdraw now, after anything you owe.", amount: available },
      { key: "pending", label: "Pending (escrow)", description: "Order money held until the buyer confirms delivery.", amount: pending },
      { key: "locked", label: "Locked", description: "Released order money in its short safety hold before it becomes available.", amount: locked },
      { key: "earningsPayable", label: "Creator earnings", description: "Gift, subscription and ad-share earnings waiting to move to your available balance.", amount: earningsPayable },
      { key: "adCredit", label: "Ad credit", description: "Prepaid credit for Nantty ads and boosts. It cannot be withdrawn.", amount: adCredit },
      { key: "coins", label: "Coins", description: "Coins to send as gifts, plus coins you earned. Coins are not cash.", amount: { amountMinor: coins.spendable + coins.earned, currency: "COIN" } },
      { key: "debts", label: "Owed to Nantty", description: "Refunds or chargebacks taken from your next earnings.", amount: debts },
    ],
    verification: {
      level: unlocked ? 1 : 0,
      withdrawalsUnlocked: unlocked,
      waitingForVerification: unlocked ? zero : available,
      nextStep: unlocked ? "identity_check" : "payout_setup",
      message: unlocked ? null : available.amountMinor > 0 ? `Verify to withdraw ${formatMoneyForDisplay(available, { showDecimals: false })}` : "Verify to withdraw your earnings",
    },
  };
};

function listWalletTransactions(): WalletTransaction[] {
  const orderTransactions: WalletTransaction[] = signedInStoreRecords()
    .filter((record) => record.status === "completed" || HELD_ORDER_STATUSES.has(record.status))
    .map((record) => ({
      id: `tx_${record.id}`,
      kind: "credit",
      amount: convertUsdCentsToViewerCurrency(sellerPayoutUsdCentsForOrderRecord(record)),
      description: record.status === "completed" ? `Escrow released · Order ${record.reference}` : `Held in escrow · Order ${record.reference}`,
      createdAt: record.releasedAt ?? record.paidAt ?? record.placedAt,
      status: record.status === "completed" ? "completed" : "pending",
    }));
  const creatorTransactions: WalletTransaction[] = signedInUserIsApprovedCreator()
    ? creatorEarningRecords.map((record) => ({
        id: `tx_${record.id}`,
        kind: "credit",
        amount: convertUsdCentsToViewerCurrency(record.usdCents),
        description: record.description,
        createdAt: isoDateHoursAgo(record.hoursAgo),
        status: record.releasesInHours === null ? "completed" : "pending",
      }))
    : [];
  const withdrawalTransactions: WalletTransaction[] = myWithdrawals().map((w) => ({
    id: w.id,
    kind: "debit",
    amount: convertUsdCentsToViewerCurrency(w.usdCents),
    description: w.description,
    createdAt: w.createdAt,
    status: w.status,
  }));
  return [...orderTransactions, ...creatorTransactions, ...withdrawalTransactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const processedWithdrawalKeys = new Map<string, WalletTransaction>();

export const walletMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/wallets/me", () => buildWalletSummary()),
  createMockRoute("GET", "/api/v1/wallets/me/transactions", () => listWalletTransactions()),
  createMockRoute("GET", "/api/v1/wallets/me/escrow-holds", () =>
    signedInStoreRecords().filter((record) => HELD_ORDER_STATUSES.has(record.status)).map(buildEscrowHoldFromRecord),
  ),
  createMockRoute("GET", "/api/v1/wallets/me/payout-accounts", () => myPayoutAccounts()),
  createMockRoute("POST", "/api/v1/wallets/me/payout-accounts", ({ body }) => {
    const { accountNumber, bankCode } = body as PayoutAccountInput;
    if (!/^\d{10}$/.test(accountNumber)) throw new ApiError(422, "Account numbers have 10 digits");
    const account: PayoutAccount = {
      id: `pa_${Date.now()}`,
      bankName: bankNameForCode(bankCode),
      accountNumberMasked: `••••${accountNumber.slice(-4)}`,
      accountName: getSignedInMockUser().name.toUpperCase(),
    };
    payoutAccountsByUserId.set(getSignedInMockUser().id, [...myPayoutAccounts(), account]);
    return account;
  }),
  createMockRoute("DELETE", "/api/v1/wallets/me/payout-accounts/:payoutAccountId", ({ params }) => {
    payoutAccountsByUserId.set(getSignedInMockUser().id, myPayoutAccounts().filter((a) => a.id !== params.payoutAccountId));
  }),
  createMockRoute("POST", "/api/v1/wallets/me/withdrawals", ({ body }) => {
    const { amount, payoutAccountId } = body as WithdrawalRequest;
    const summary = buildWalletSummary();
    if (!summary.verification?.withdrawalsUnlocked) throw new ApiError(403, "Verify your payout details to withdraw. Your money stays in your wallet.", "VERIFICATION_REQUIRED");
    if (amount.currency !== summary.available.currency) throw new ApiError(422, "Withdrawals must be in your wallet currency");
    if (amount.amountMinor > summary.available.amountMinor) throw new ApiError(422, "Amount is more than your available balance");
    const account = myPayoutAccounts().find((a) => a.id === payoutAccountId);
    if (!account) throw new ApiError(404, "Choose a payout account");
    const duplicateKey = `${payoutAccountId}:${amount.amountMinor}:${myWithdrawals().length}`;
    const duplicate = processedWithdrawalKeys.get(duplicateKey);
    if (duplicate) return duplicate;
    const withdrawal: MockWithdrawal = {
      id: `wd_${Date.now()}`,
      usdCents: convertViewerMoneyToUsdCents(amount),
      description: `Withdrawal to ${account.bankName} ${account.accountNumberMasked}`,
      createdAt: new Date().toISOString(),
      status: "pending",
      userId: getSignedInMockUser().id,
    };
    withdrawals.unshift(withdrawal);
    const transaction: WalletTransaction = { id: withdrawal.id, kind: "debit", amount, description: withdrawal.description, createdAt: withdrawal.createdAt, status: "pending" };
    processedWithdrawalKeys.set(duplicateKey, transaction);
    return transaction;
  }),
];
