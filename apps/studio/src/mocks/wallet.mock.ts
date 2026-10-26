import { createMockRoute, type MockRoute } from "@/mocks/registry.mock";
import { readMockPayoutOnboardingState } from "@/mocks/payoutOnboarding.mock";
import type { Money } from "@/types";
import type { NanttyWalletSummary } from "@/types/nanttyWallet.type";

const ngn = (amountMinor: number): Money => ({ amountMinor, currency: "NGN" });
const nairaText = (money: Money) => `₦${new Intl.NumberFormat("en-NG").format(money.amountMinor / 100)}`;

function buildMockWallet(): NanttyWalletSummary {
  const unlocked = readMockPayoutOnboardingState().withdrawalsEnabled;
  const available = ngn(0);
  const earningsPayable = ngn(1_250_000);
  const coins = { spendable: 0, earned: 3_400 };
  const waiting = unlocked ? ngn(0) : ngn(available.amountMinor + earningsPayable.amountMinor);
  return {
    available, pending: ngn(0), locked: ngn(0), inEscrow: ngn(0), payoutRequested: ngn(0), negativeBalance: ngn(0), nextAvailableAt: null,
    adCredit: ngn(0), earningsPayable, debts: ngn(0), coins,
    lines: [
      { key: "available", label: "Available to withdraw", description: "Sales and creator earnings you can withdraw now, after anything you owe.", amount: available },
      { key: "pending", label: "Pending (escrow)", description: "Order money held until the buyer confirms delivery.", amount: ngn(0) },
      { key: "locked", label: "Locked", description: "Released order money in its short safety hold before it becomes available.", amount: ngn(0) },
      { key: "earningsPayable", label: "Creator earnings", description: "Gift, subscription and ad-share earnings waiting to move to your available balance.", amount: earningsPayable },
      { key: "adCredit", label: "Ad credit", description: "Prepaid credit for Nantty ads and boosts. It cannot be withdrawn.", amount: ngn(0) },
      { key: "coins", label: "Coins", description: "Coins to send as gifts, plus coins you earned. Coins are not cash.", amount: { amountMinor: coins.spendable + coins.earned, currency: "COIN" } },
      { key: "debts", label: "Owed to Nantty", description: "Refunds or chargebacks taken from your next earnings.", amount: ngn(0) },
    ],
    verification: {
      level: unlocked ? 1 : 0,
      withdrawalsUnlocked: unlocked,
      waitingForVerification: waiting,
      nextStep: unlocked ? "identity_check" : "payout_setup",
      message: unlocked ? null : waiting.amountMinor > 0 ? `Verify to withdraw ${nairaText(waiting)}` : "Verify to withdraw your earnings",
    },
  };
}

export const walletMocks: MockRoute[] = [createMockRoute("GET", "/api/v1/wallets/me", () => buildMockWallet())];
