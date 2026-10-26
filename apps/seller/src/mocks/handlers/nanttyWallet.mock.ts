import { readMockPayoutOnboardingState } from "@/mocks/handlers/payoutOnboarding.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockStorePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { Money } from "@/types/money.type";
import type { ZudomartWalletSummary } from "@/types/zudomartWallet.type";
import { formatMoneyForDisplay } from "@/utils/money.util";

const coins = { spendable: 1_200, earned: 350 };

export function buildMockZudomartWallet(storeId: string): ZudomartWalletSummary {
  const database = readMockDatabase();
  const currency = database.settings.currency;
  const money = (amountMinor: number): Money => ({ amountMinor, currency });
  const { escrow, pending, available } = database.wallet.balances;
  const earningsPayable = money(450_000);
  const adCredit = money(200_000);
  const debts = money(0);
  const onboarding = readMockPayoutOnboardingState(storeId);
  const unlocked = onboarding.withdrawalsEnabled;
  const waiting = unlocked ? money(0) : money(available.amountMinor + earningsPayable.amountMinor);
  return {
    available, pending: escrow, locked: pending, inEscrow: escrow, payoutRequested: money(0), negativeBalance: debts, nextAvailableAt: database.wallet.balances.nextEscrowReleaseAt,
    adCredit, earningsPayable, debts, coins,
    lines: [
      { key: "available", label: "Available to withdraw", description: "Sales and creator earnings you can withdraw now, after anything you owe.", amount: available },
      { key: "pending", label: "Pending (escrow)", description: "Order money held until the buyer confirms delivery.", amount: escrow },
      { key: "locked", label: "Locked", description: "Released order money in its short safety hold before it becomes available.", amount: pending },
      { key: "earningsPayable", label: "Creator earnings", description: "Gift, subscription and ad-share earnings waiting to move to your available balance.", amount: earningsPayable },
      { key: "adCredit", label: "Ad credit", description: "Prepaid credit for Zudomart ads and boosts. It cannot be withdrawn.", amount: adCredit },
      { key: "coins", label: "Coins", description: "Coins to send as gifts, plus coins you earned. Coins are not cash.", amount: { amountMinor: coins.spendable + coins.earned, currency: "COIN" } },
      { key: "debts", label: "Owed to Zudomart", description: "Refunds or chargebacks taken from your next earnings.", amount: debts },
    ],
    verification: {
      level: unlocked ? 1 : 0,
      withdrawalsUnlocked: unlocked,
      waitingForVerification: waiting,
      nextStep: unlocked ? "identity_check" : "payout_setup",
      message: unlocked ? null : waiting.amountMinor > 0 ? `Verify to withdraw ${formatMoneyForDisplay(waiting)}` : "Verify to withdraw your earnings",
    },
  };
}

export function registerZudomartWalletMockHandlers(): void {
  registerMockRoute("GET", "/wallets/me", (request) => respondWithJson(200, buildMockZudomartWallet(requireMockStorePrincipal(request).storeId)));
}
