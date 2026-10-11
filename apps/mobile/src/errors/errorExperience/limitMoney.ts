function readMoney(value: unknown): { readonly amountMinor: number; readonly currency: string } | null {
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

export function readPositiveMoney(value: unknown): string | null {
  const money = readMoney(value);
  return money && money.amountMinor > 0 ? formatLimitMoney(money) : null;
}
