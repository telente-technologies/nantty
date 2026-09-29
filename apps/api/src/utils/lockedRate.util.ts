import { CURRENCY_MINOR_UNIT_DIGITS } from "../configs/currency.config.js";
import type { LockedExchangeRate } from "../interfaces/currencyConverter.interface.js";
import { convertMinorUnitsWithScaledRate } from "./exchangeRate.util.js";
import { CurrencyMismatchError, Money } from "./money.util.js";

export function applyLockedExchangeRate(money: Money, rate: LockedExchangeRate): Money {
  if (money.currency !== rate.sourceCurrency) throw new CurrencyMismatchError(money.currency, rate.sourceCurrency);
  if (rate.sourceCurrency === rate.targetCurrency) return money;
  const converted = convertMinorUnitsWithScaledRate(
    money.amountMinor,
    rate.scaledRate,
    CURRENCY_MINOR_UNIT_DIGITS[rate.sourceCurrency],
    CURRENCY_MINOR_UNIT_DIGITS[rate.targetCurrency],
  );
  return Money.of(converted, rate.targetCurrency);
}
