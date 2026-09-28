import { UnprocessableEntityError } from "@zudojs/errors";

import type { Kobo } from "../types/money.type.js";

export function convertDatabaseAmountToKobo(value: bigint | number): Kobo {
  const amount = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(amount)) throw new RangeError(`Amount ${String(value)} is not a safe integer.`);
  return amount;
}

export function assertValidKoboAmount(amount: number, label = "amount"): Kobo {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new UnprocessableEntityError(`${label} must be a non-negative integer number of kobo.`);
  }
  return amount;
}

export function sumKoboAmounts(values: readonly Kobo[]): Kobo {
  return assertValidKoboAmount(values.reduce((total, value) => total + value, 0), "total");
}

export function multiplyKoboByQuantity(unit: Kobo, quantity: number): Kobo {
  return assertValidKoboAmount(unit * quantity, "line total");
}

export function calculateBasisPointsShare(amount: Kobo, bps: number): Kobo {
  return Number((BigInt(amount) * BigInt(bps)) / 10_000n);
}
