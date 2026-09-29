import type { TransferFeeOverride } from "../../../configs/monetization.config.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";

interface TransferFeeTier {
  readonly upToMinor: MinorUnits;
  readonly feeMinor: MinorUnits;
}

const PUBLISHED_TRANSFER_FEE_TIERS: Readonly<Record<string, readonly TransferFeeTier[]>> = {
  "paystack:NGN": [
    { upToMinor: 500_000, feeMinor: 1_000 },
    { upToMinor: 5_000_000, feeMinor: 2_500 },
    { upToMinor: Number.MAX_SAFE_INTEGER, feeMinor: 5_000 },
  ],
  "flutterwave:NGN": [
    { upToMinor: 500_000, feeMinor: 1_075 },
    { upToMinor: 5_000_000, feeMinor: 2_688 },
    { upToMinor: Number.MAX_SAFE_INTEGER, feeMinor: 5_375 },
  ],
};

export class PayoutTransferFeeSchedule {
  public constructor(private readonly overrides: readonly TransferFeeOverride[]) {}

  public calculateTransferFee(provider: string, currency: CurrencyCode, amount: MinorUnits): MinorUnits {
    const override = this.overrides.find((candidate) => candidate.provider === provider && candidate.currency === currency);
    if (override !== undefined) return override.feeMinor;
    const tiers = PUBLISHED_TRANSFER_FEE_TIERS[`${provider}:${currency}`] ?? [];
    return tiers.find((tier) => amount <= tier.upToMinor)?.feeMinor ?? 0;
  }
}
