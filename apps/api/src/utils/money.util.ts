import { UnprocessableEntityError } from "@zudojs/errors";

import { isSupportedCurrencyCode, type CurrencyCode } from "../enums/currency.enum.js";
import type { MinorUnits } from "../types/money.type.js";

export class CurrencyMismatchError extends Error {
  public constructor(leftCurrency: string, rightCurrency: string) {
    super(`Cannot combine amounts in ${leftCurrency} and ${rightCurrency}; convert one of them first.`);
    this.name = "CurrencyMismatchError";
  }
}

export interface MoneyDto {
  readonly amountMinor: MinorUnits;
  readonly currency: CurrencyCode;
}

export class Money {
  private constructor(public readonly amountMinor: MinorUnits, public readonly currency: CurrencyCode) {}

  public static of(amountMinor: number | bigint, currency: string): Money {
    const amount = typeof amountMinor === "bigint" ? Number(amountMinor) : amountMinor;
    if (!Number.isSafeInteger(amount)) throw new RangeError(`Amount ${String(amountMinor)} is not a safe whole number of minor units.`);
    if (!isSupportedCurrencyCode(currency)) throw new RangeError(`Currency "${currency}" is not supported.`);
    return new Money(amount, currency);
  }

  public static zero(currency: CurrencyCode): Money {
    return new Money(0, currency);
  }

  public static sum(amounts: readonly Money[], currency: CurrencyCode): Money {
    return amounts.reduce((total, amount) => total.add(amount), Money.zero(currency));
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amountMinor + other.amountMinor, this.currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amountMinor - other.amountMinor, this.currency);
  }

  public multiplyByQuantity(quantity: number): Money {
    if (!Number.isSafeInteger(quantity)) throw new RangeError("Quantities must be whole numbers.");
    return Money.of(this.amountMinor * quantity, this.currency);
  }

  public calculateBasisPointsShareRoundingDown(basisPoints: number): Money {
    return Money.of((BigInt(this.amountMinor) * BigInt(basisPoints)) / 10_000n, this.currency);
  }

  public isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinor > other.amountMinor;
  }

  public equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  public isNegative(): boolean {
    return this.amountMinor < 0;
  }

  public toDto(): MoneyDto {
    return { amountMinor: this.amountMinor, currency: this.currency };
  }

  public toJSON(): MoneyDto {
    return this.toDto();
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) throw new CurrencyMismatchError(this.currency, other.currency);
  }
}

export function convertDatabaseAmountToMinorUnits(value: bigint | number): MinorUnits {
  const amount = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(amount)) throw new RangeError(`Amount ${String(value)} is not a safe integer.`);
  return amount;
}

export function assertValidMinorUnitAmount(amount: number, label = "amount"): MinorUnits {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new UnprocessableEntityError(`${label} must be a non-negative whole number of minor currency units.`);
  }
  return amount;
}

export function sumMinorUnitAmounts(values: readonly MinorUnits[]): MinorUnits {
  return assertValidMinorUnitAmount(values.reduce((total, value) => total + value, 0), "total");
}

export function multiplyMinorUnitsByQuantity(unit: MinorUnits, quantity: number): MinorUnits {
  return assertValidMinorUnitAmount(unit * quantity, "line total");
}

export function calculateBasisPointsShare(amount: MinorUnits, basisPoints: number): MinorUnits {
  return Number((BigInt(amount) * BigInt(basisPoints)) / 10_000n);
}
