import type { Money, WalletLine, WalletLineAmount, WalletSummary } from "@/types";

import { formatMoneyForDisplay } from "./formatMoney.util";

const LEGACY_LINES: readonly { readonly key: "available" | "pending"; readonly label: string; readonly description: string }[] = [
  { key: "available", label: "Available to withdraw", description: "Sales and creator earnings you can withdraw now, after anything you owe." },
  { key: "pending", label: "Pending (escrow)", description: "Order money held until the buyer confirms delivery." },
];

export function formatCoinCount(count: number): string {
  const whole = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  return `${whole.toLocaleString("en-US")} ${whole === 1 ? "coin" : "coins"}`;
}

export function formatWalletLineAmount(amount: WalletLineAmount): string {
  if (amount.currency === "COIN") return formatCoinCount(amount.amountMinor);
  return formatMoneyForDisplay(amount as Money);
}

export function walletLinesForDisplay(wallet: WalletSummary | undefined): readonly WalletLine[] {
  if (!wallet) return [];
  const lines = (wallet.lines ?? []).filter((line) => line && line.amount && typeof line.amount.amountMinor === "number");
  if (lines.length > 0) return lines;
  return LEGACY_LINES.filter((line) => wallet[line.key]).map((line) => ({ ...line, amount: wallet[line.key] }));
}

export function walletVerificationMessage(wallet: WalletSummary | undefined): string | null {
  const message = wallet?.verification?.message?.trim();
  return message ? message : null;
}
