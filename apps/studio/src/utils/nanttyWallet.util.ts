import type { Money } from "@/types";
import type { ZudomartWalletLine, ZudomartWalletSummary } from "@/types/zudomartWallet.type";

import { detectDeviceLocaleTag } from "./deviceRegion.util";
import { formatMoneyForDisplay } from "./formatMoney.util";

const isAmount = (value: unknown): value is Money =>
  typeof value === "object" && value !== null && typeof (value as Money).amountMinor === "number" && typeof (value as Money).currency === "string";

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

export function formatWalletLineAmount(amount: Money): string {
  if (amount.currency === "COIN") {
    const whole = Math.trunc(amount.amountMinor);
    return `${new Intl.NumberFormat(detectDeviceLocaleTag()).format(whole)} ${whole === 1 ? "coin" : "coins"}`;
  }
  try {
    return formatMoneyForDisplay(amount);
  } catch {
    return `${amount.amountMinor / 100} ${amount.currency}`;
  }
}
