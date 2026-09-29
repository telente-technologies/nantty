export const EXCHANGE_RATE_SCALE = 1_000_000_000n;
const EXCHANGE_RATE_SCALE_DIGITS = 9;

export function divideRoundingHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new RangeError("Cannot divide by zero.");
  const negative = numerator < 0n !== denominator < 0n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = (absoluteNumerator * 2n + absoluteDenominator) / (absoluteDenominator * 2n);
  return negative ? -quotient : quotient;
}

export function parseDecimalRateToScaledInteger(rate: string): bigint {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(rate.trim());
  if (match === null) throw new RangeError(`"${rate}" is not a positive decimal exchange rate.`);
  const wholePart = BigInt(match[1] ?? "0");
  const fraction = match[2] ?? "";
  const keptFraction = fraction.slice(0, EXCHANGE_RATE_SCALE_DIGITS).padEnd(EXCHANGE_RATE_SCALE_DIGITS, "0");
  let scaled = wholePart * EXCHANGE_RATE_SCALE + BigInt(keptFraction);
  if ((fraction[EXCHANGE_RATE_SCALE_DIGITS] ?? "0") >= "5") scaled += 1n;
  if (scaled <= 0n) throw new RangeError("Exchange rates must be greater than zero.");
  return scaled;
}

export function formatScaledRateAsDecimal(scaledRate: bigint): string {
  const whole = scaledRate / EXCHANGE_RATE_SCALE;
  const fraction = (scaledRate % EXCHANGE_RATE_SCALE).toString().padStart(EXCHANGE_RATE_SCALE_DIGITS, "0").replace(/0+$/, "");
  return fraction === "" ? whole.toString() : `${whole.toString()}.${fraction}`;
}

export function calculateCrossRateThroughUsDollar(unitsOfSourcePerUsDollar: bigint, unitsOfTargetPerUsDollar: bigint): bigint {
  return divideRoundingHalfUp(unitsOfTargetPerUsDollar * EXCHANGE_RATE_SCALE, unitsOfSourcePerUsDollar);
}

export function convertMinorUnitsWithScaledRate(
  amountMinor: number,
  scaledRate: bigint,
  sourceMinorDigits: number,
  targetMinorDigits: number,
): number {
  const digitShift = targetMinorDigits - sourceMinorDigits;
  const numerator = BigInt(amountMinor) * scaledRate * 10n ** BigInt(Math.max(0, digitShift));
  const denominator = EXCHANGE_RATE_SCALE * 10n ** BigInt(Math.max(0, -digitShift));
  const converted = divideRoundingHalfUp(numerator, denominator);
  if (converted > BigInt(Number.MAX_SAFE_INTEGER) || converted < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError("The converted amount is too large.");
  }
  return Number(converted);
}
