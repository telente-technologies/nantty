import type { Money, WalletLine, WalletSummary, WalletVerification } from "../types";

import { formatMoneyForDisplay } from "./formatMoney.util";

const isAmount = (value: unknown): value is WalletLine["amount"] =>
  typeof value === "object" && value !== null && typeof (value as Money).amountMinor === "number" && typeof (value as Money).currency === "string";

const isWalletLine = (value: unknown): value is WalletLine =>
  typeof value === "object" && value !== null && typeof (value as WalletLine).key === "string" && typeof (value as WalletLine).label === "string" && isAmount((value as WalletLine).amount);

export function readWalletLines(summary: WalletSummary): readonly WalletLine[] {
  const lines = Array.isArray(summary.lines) ? summary.lines.filter(isWalletLine) : [];
  if (lines.length > 0) return lines.map((line) => ({ ...line, description: typeof line.description === "string" ? line.description : "" }));
  const fallback: WalletLine[] = [];
  if (isAmount(summary.available)) fallback.push({ key: "available", label: "Available to withdraw", description: "", amount: summary.available });
  if (isAmount(summary.pending)) fallback.push({ key: "pending", label: "Pending (escrow)", description: "Order money held until the buyer confirms delivery.", amount: summary.pending });
  return fallback;
}

export function formatCoinCount(coins: number): string {
  const whole = Number.isFinite(coins) ? Math.trunc(coins) : 0;
  return `${whole.toLocaleString("en-US")} ${Math.abs(whole) === 1 ? "coin" : "coins"}`;
}

export function formatWalletLineAmount(line: Pick<WalletLine, "amount">): string {
  if (line.amount.currency === "COIN") return formatCoinCount(line.amount.amountMinor);
  try {
    return formatMoneyForDisplay(line.amount as Money);
  } catch {
    return `${(line.amount.amountMinor / 100).toFixed(2)} ${line.amount.currency}`;
  }
}

export function readWalletVerification(summary: WalletSummary | undefined): WalletVerification | null {
  const verification = summary?.verification;
  return verification && typeof verification === "object" ? verification : null;
}

export function readVerificationLevel(summary: WalletSummary | undefined): number {
  const verification = readWalletVerification(summary);
  if (!verification) return 0;
  if (typeof verification.level === "number") return verification.level;
  return verification.withdrawalsUnlocked ? 1 : 0;
}

export function readVerifyToWithdrawMessage(summary: WalletSummary | undefined): string | null {
  const message = readWalletVerification(summary)?.message;
  return typeof message === "string" && message.trim() ? message : null;
}

export function verifyActionForWallet(summary: WalletSummary | undefined, payoutHref: string): { readonly href: string; readonly label: string } {
  const nextStep = readWalletVerification(summary)?.nextStep;
  if (nextStep === "business_verification") return { href: "/seller/apply", label: "Finish business verification" };
  return { href: payoutHref, label: "Set up payouts" };
}
