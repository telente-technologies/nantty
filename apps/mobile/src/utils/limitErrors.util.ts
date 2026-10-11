export const limitErrorCodes = ["SELLER_DEBT_LIMIT", "PAYMENT_AMOUNT_OUT_OF_RANGE", "WALLET_DAILY_LIMIT"] as const;

type Details = Readonly<Record<string, unknown>> | null | undefined;

function readMoney(value: unknown): { amountMinor: number; currency: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const { amountMinor, currency } = value as { amountMinor?: unknown; currency?: unknown };
  return typeof amountMinor === "number" && typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? { amountMinor, currency } : null;
}

export function formatLimitMoney(value: unknown): string | null {
  const money = readMoney(value);
  if (!money) return null;
  const major = money.amountMinor / 100;
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: money.currency, maximumFractionDigits: Number.isInteger(major) ? 0 : 2 }).format(major);
  } catch {
    return `${money.currency} ${major.toLocaleString("en-US")}`;
  }
}

export function describeLimitError(code: string | null | undefined, details: Details): string | null {
  if (code === "SELLER_DEBT_LIMIT") {
    return "You owe more than your selling limit allows. Clear what you owe to list items and take new orders again. Orders you already have aren't affected.";
  }
  if (code === "WALLET_DAILY_LIMIT") {
    const remaining = readMoney(details?.["remaining"]);
    const limit = formatLimitMoney(details?.["limit"]);
    if (remaining && remaining.amountMinor > 0) return `You can pay ${formatLimitMoney(remaining)} more from your wallet today. Pay by card, or try again tomorrow.`;
    return limit ? `You've reached today's wallet limit of ${limit}. Pay by card, or try again tomorrow.` : "You've reached today's wallet limit. Pay by card, or try again tomorrow.";
  }
  if (code === "PAYMENT_AMOUNT_OUT_OF_RANGE") {
    const maximum = formatLimitMoney(details?.["maximum"]);
    const minimum = formatLimitMoney(details?.["minimum"]);
    if (details?.["reason"] === "contactSupportForLargeOrders") return `Orders above ${maximum ?? "this amount"} need a quick check first. Contact support to place a large order.`;
    if (maximum) return `The most you can pay in one go here is ${maximum}.`;
    if (minimum) return `The smallest payment here is ${minimum}.`;
    return "This amount can't be paid in one payment.";
  }
  return null;
}
