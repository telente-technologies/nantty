import { formatLimitMoney } from "./limitErrors.util";

export interface WalletLimitMoney {
  readonly amountMinor: number;
  readonly currency: string;
}

export interface WalletDailyLimits {
  readonly tier: "basic" | "mid" | "full";
  readonly dailyLimit: WalletLimitMoney;
  readonly spentToday: WalletLimitMoney;
  readonly remainingToday: WalletLimitMoney;
  readonly resetsAt: string;
}

const tierNames: Record<WalletDailyLimits["tier"], string> = { basic: "basic", mid: "mid", full: "full" };

export function describeWalletDailyLimit(limits: WalletDailyLimits | null | undefined): string | null {
  if (!limits || limits.dailyLimit.amountMinor <= 0) return null;
  const limit = formatLimitMoney(limits.dailyLimit);
  const remaining = formatLimitMoney(limits.remainingToday);
  if (!limit || !remaining) return null;
  if (limits.remainingToday.amountMinor <= 0) return `You've used today's ${limit} wallet limit (${tierNames[limits.tier]} tier). It resets at midnight, Lagos time.`;
  return `You can pay ${remaining} more from your wallet today. Your daily limit is ${limit} (${tierNames[limits.tier]} tier) and resets at midnight, Lagos time.`;
}
