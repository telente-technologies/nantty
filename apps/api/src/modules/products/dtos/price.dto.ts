import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { MoneyConversion } from "../../../interfaces/currencyConverter.interface.js";
import { Money, type MoneyDto } from "../../../utils/money.util.js";

export const keepNativeCurrency: MoneyConversion = (money) => money;

export function presentPriceInCurrency(amountMinor: number, currency: CurrencyCode, convert: MoneyConversion): MoneyDto {
  return convert(Money.of(amountMinor, currency)).toDto();
}
