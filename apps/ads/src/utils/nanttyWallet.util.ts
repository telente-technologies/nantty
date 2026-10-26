import type { Money } from "@/types/money.type";
import type { NanttyWalletLine, NanttyWalletSummary } from "@/types/nanttyWallet.type";
import { formatMoneyForDisplay } from "@/utils/money.util";

const isAmount = (value: unknown): value is Money =>
  typeof value === "object" && value !== null && typeof (value as Money).amountMinor === "number" && typeof (value as Money).currency === "string";

export function readWalletLines(summary: NanttyWalletSummary | null | undefined): NanttyWalletLine[] {
  if (!summary) return [];
  if (Array.isArray(summary.lines)) return summary.lines.filter((line) => line && typeof line.label === "string" && isAmount(line.amount));
  const fallback: NanttyWalletLine[] = [];
  if (isAmount(summary.available)) fallback.push({ key: "available", label: "Available to withdraw", description: "Sales and creator earnings you can withdraw now, after anything you owe.", amount: summary.available });
  if (isAmount(summary.pending)) fallback.push({ key: "pending", label: "Pending", description: "Money that is not yet available to withdraw.", amount: summary.pending });
  return fallback;
}

export function readAvailableToWithdraw(summary: NanttyWalletSummary | null | undefined): NanttyWalletLine | null {
  return readWalletLines(summary).find((line) => line.key === "available") ?? null;
}

export function formatWalletLineAmount(amount: Money): string {
  if (amount.currency !== "COIN") return formatMoneyForDisplay(amount);
  const whole = Math.trunc(amount.amountMinor);
  return `${new Intl.NumberFormat("en-NG").format(whole)} ${whole === 1 ? "coin" : "coins"}`;
}

export function readSafeVerifyUrl(candidate: string | null | undefined, fallback: string): string {
  try {
    const url = new URL(candidate ?? "");
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}
