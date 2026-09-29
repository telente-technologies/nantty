import type { Money } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export interface MoneyDisplayParts {
  readonly symbol: string;
  readonly amount: string;
}

export function splitMoneyIntoSymbolAndAmount(money: Money): MoneyDisplayParts {
  const formatted = formatMoneyForDisplay(money);
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: money.currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(money.amountMinor / 100);
    const symbol = parts.filter((p) => p.type === "currency").map((p) => p.value).join("");
    const amount = parts.filter((p) => p.type !== "currency" && p.type !== "literal").map((p) => p.value).join("");
    return symbol ? { symbol, amount } : { symbol: "", amount: formatted };
  } catch {
    return { symbol: "", amount: formatted };
  }
}
