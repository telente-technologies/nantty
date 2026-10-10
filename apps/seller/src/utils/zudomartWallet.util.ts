import type { WalletLineAmount, ZudomartWalletLine, ZudomartWalletSummary } from "@/types/zudomartWallet.type";

const isAmount = (value: unknown): value is WalletLineAmount =>
  typeof value === "object" && value !== null && typeof (value as WalletLineAmount).amountMinor === "number" && typeof (value as WalletLineAmount).currency === "string";

export function readWalletLines(summary: ZudomartWalletSummary | null | undefined): ZudomartWalletLine[] {
  if (!summary) return [];
  if (Array.isArray(summary.lines)) return summary.lines.filter((line) => line && typeof line.label === "string" && isAmount(line.amount));
  const fallback: ZudomartWalletLine[] = [];
  if (isAmount(summary.available)) fallback.push({ key: "available", label: "Available to withdraw", description: "Sales and creator earnings you can withdraw now, after anything you owe.", amount: summary.available });
  if (isAmount(summary.pending)) fallback.push({ key: "pending", label: "Pending", description: "Money that is not yet available to withdraw.", amount: summary.pending });
  return fallback;
}

export function readVerificationMessage(summary: ZudomartWalletSummary | null | undefined): string | null {
  const message = summary?.verification?.message;
  return typeof message === "string" && message.trim() ? message : null;
}

export function formatCoinCount(count: number, locale = "en-NG"): string {
  const whole = Math.trunc(count);
  return `${new Intl.NumberFormat(locale).format(whole)} ${whole === 1 ? "coin" : "coins"}`;
}
