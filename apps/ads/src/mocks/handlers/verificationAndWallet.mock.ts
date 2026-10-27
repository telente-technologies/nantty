import { requireAccountAccess } from "@/mocks/mockAccountAccess.mock";
import { appendMockActivity, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockId, failValidation, readIsoNow, readJsonObjectBody, requirePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { Money } from "@/types/money.type";
import type { NanttyWalletSummary } from "@/types/nanttyWallet.type";
import { formatMoneyForDisplay } from "@/utils/money.util";

interface MockUserWallet {
  level: number;
  availableMinor: number;
  readonly fundings: Map<string, { readonly fingerprint: string; readonly response: { fundingId: string; amount: Money; status: "succeeded" } }>;
}

const unverifiedUserIds = new Set(["usr_ibrahim"]);
const verificationRequiredMessage = "Verify your payout details to use Nantty Ads. Your verification keeps advertisers and creators safe.";
const holder = globalThis as typeof globalThis & { __nanttyAdsMockWallets?: Map<string, MockUserWallet> };

function readMockUserWallet(userId: string): MockUserWallet {
  const wallets = (holder.__nanttyAdsMockWallets ??= new Map());
  if (!wallets.has(userId)) wallets.set(userId, { level: unverifiedUserIds.has(userId) ? 0 : 1, availableMinor: unverifiedUserIds.has(userId) ? 1_250_000 : 8_500_000, fundings: new Map() });
  return wallets.get(userId) as MockUserWallet;
}

function readVerifyUrl(): string {
  return `${process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? "https://nantty.com"}/settings/payouts`;
}

export function requireMockAdsVerification(userId: string): void {
  if (readMockUserWallet(userId).level < 1) throw new MockHttpError(403, "VERIFICATION_REQUIRED", verificationRequiredMessage);
}

function presentWallet(userId: string, wallet: MockUserWallet): NanttyWalletSummary {
  const ngn = (amountMinor: number): Money => ({ amountMinor, currency: "NGN" });
  const database = readMockDatabase();
  const adCreditMinor = database.accounts.filter((account) => account.currency === "NGN" && account.ownerUserId === userId).reduce((total, account) => total + account.balanceMinor, 0);
  const unlocked = wallet.level >= 1;
  const coins = { spendable: 600, earned: 0 };
  const waiting = unlocked ? ngn(0) : ngn(wallet.availableMinor);
  return {
    available: ngn(wallet.availableMinor), pending: ngn(0), locked: ngn(0), inEscrow: ngn(0), payoutRequested: ngn(0), negativeBalance: ngn(0), nextAvailableAt: null,
    adCredit: ngn(adCreditMinor), earningsPayable: ngn(0), debts: ngn(0), coins,
    lines: [
      { key: "available", label: "Available to withdraw", description: "Sales and creator earnings you can withdraw now, after anything you owe.", amount: ngn(wallet.availableMinor) },
      { key: "pending", label: "Pending (escrow)", description: "Order money held until the buyer confirms delivery.", amount: ngn(0) },
      { key: "locked", label: "Locked", description: "Released order money in its short safety hold before it becomes available.", amount: ngn(0) },
      { key: "earningsPayable", label: "Creator earnings", description: "Gift, subscription and ad-share earnings waiting to move to your available balance.", amount: ngn(0) },
      { key: "adCredit", label: "Ad credit", description: "Prepaid credit for Nantty ads and boosts. It cannot be withdrawn.", amount: ngn(adCreditMinor) },
      { key: "coins", label: "Coins", description: "Coins to send as gifts, plus coins you earned. Coins are not cash.", amount: { amountMinor: coins.spendable + coins.earned, currency: "COIN" } },
      { key: "debts", label: "Owed to Nantty", description: "Refunds or chargebacks taken from your next earnings.", amount: ngn(0) },
    ],
    verification: { level: wallet.level, withdrawalsUnlocked: unlocked, waitingForVerification: waiting, nextStep: unlocked ? "identity_check" : "payout_setup", message: unlocked ? null : `Verify to withdraw ${formatMoneyForDisplay(waiting)}` },
  };
}

export function registerVerificationAndWalletMockHandlers(): void {
  registerMockRoute("GET", "/ads/verification", (request) => {
    const { level } = readMockUserWallet(requirePrincipal(request).userId);
    const verified = level >= 1;
    return respondWithJson(200, { level, verified, nextStep: verified ? "identity_check" : "payout_setup", message: verified ? null : "Verify your payout details to use Nantty Ads.", verifyUrl: readVerifyUrl() });
  });

  registerMockRoute("GET", "/wallets/me", (request) => {
    const { userId } = requirePrincipal(request);
    return respondWithJson(200, presentWallet(userId, readMockUserWallet(userId)));
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/billing/fund-from-earnings", (request) => {
    const { account, userId, actorName } = requireAccountAccess(request, "billing:manage");
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey) throw new MockHttpError(400, "IDEMPOTENCY_KEY_REQUIRED", "Payments need an Idempotency-Key header.");
    const wallet = readMockUserWallet(userId);
    requireMockAdsVerification(userId);
    if (account.ownerUserId !== userId) throw new MockHttpError(403, "FORBIDDEN", "Only the owner of this ad account can pay from their Nantty balance.");
    const body = readJsonObjectBody(request);
    const amount = typeof body.amount === "object" && body.amount ? (body.amount as { amountMinor?: unknown; currency?: unknown }) : {};
    if (amount.currency !== account.currency) failValidation("amount", `Pay in ${account.currency}, the currency of this ad account.`);
    if (!Number.isSafeInteger(amount.amountMinor) || (amount.amountMinor as number) <= 0) failValidation("amount", "Enter an amount.");
    const fingerprint = `${account.id}:${String(amount.amountMinor)}:${String(amount.currency)}`;
    const replay = wallet.fundings.get(idempotencyKey);
    if (replay) {
      if (replay.fingerprint !== fingerprint) throw new MockHttpError(409, "IDEMPOTENCY_KEY_REUSED", "This payment key was already used for a different payment.");
      return respondWithJson(201, replay.response);
    }
    if ((amount.amountMinor as number) > wallet.availableMinor) throw new MockHttpError(422, "INSUFFICIENT_FUNDS", "Amount is more than your available balance.");
    const funded: Money = { amountMinor: amount.amountMinor as number, currency: account.currency };
    wallet.availableMinor -= funded.amountMinor;
    account.balanceMinor += funded.amountMinor;
    const response = { fundingId: createMockId("fund"), amount: funded, status: "succeeded" as const };
    wallet.fundings.set(idempotencyKey, { fingerprint, response });
    readMockDatabase().transactions.unshift({ id: createMockId("txn"), accountId: account.id, type: "top_up", amount: funded, description: "Paid from Nantty balance", reference: response.fundingId, createdAt: readIsoNow(), receiptAvailable: false });
    appendMockActivity(account.id, { actor: { id: userId, name: actorName, isSystem: false }, action: "balance_topped_up", objectType: "billing", objectId: response.fundingId, objectName: "Paid from Nantty balance", summary: `Added ${formatMoneyForDisplay(funded)} from the Nantty balance`, changes: [] });
    return respondWithJson(201, response);
  });
}
