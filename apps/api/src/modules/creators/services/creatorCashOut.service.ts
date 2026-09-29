import type { MonetizationSettings } from "../../../configs/monetization.config.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { unprocessable } from "../../../errors/domain.error.js";
import { Money } from "../../../utils/money.util.js";
import type { CoinConversionReceiptDto, CreatorRevenueRulesDto } from "../dtos/creators.dto.js";
import type { CreatorsService } from "./creators.service.js";

export interface CoinConversionRequest {
  readonly userId: string;
  readonly coins: number;
  readonly currency: CurrencyCode;
  readonly idempotencyKey: string;
}

export function calculateCashValueOfCoins(settings: MonetizationSettings, coins: number, currency: CurrencyCode): Money {
  return Money.of(coins * settings.coins.cashValuePerCoinMinor[currency], currency);
}

export class CreatorCashOutService {
  public constructor(private readonly creatorsService: CreatorsService, private readonly monetization: MonetizationSettings) {}

  public async convertEarnedCoinsToCash(request: CoinConversionRequest): Promise<CoinConversionReceiptDto> {
    const { creatorWallets, audit } = this.creatorsService.dependencies;
    await this.creatorsService.findApprovedProfileOrThrow(request.userId);
    const cash = calculateCashValueOfCoins(this.monetization, request.coins, request.currency);
    const minimum = Money.of(this.monetization.creators.minimumPayoutMinor, request.currency);
    if (minimum.isGreaterThan(cash)) {
      throw unprocessable(`Convert at least ${minimum.amountMinor} minor units of ${request.currency}; ${request.coins} coins are worth ${cash.amountMinor}.`);
    }
    const balances = await creatorWallets.findCreatorCoinBalances(request.userId);
    if (balances.earnedCoins < request.coins) throw unprocessable("You do not have enough earned coins to convert.");
    const reference = `creator-coin-conversion:${request.userId}:${request.idempotencyKey}`;
    const result = await creatorWallets.convertEarnedCoinsToCash({ reference, creatorUserId: request.userId, coins: request.coins, cash });
    if (result.created) {
      await audit.record({ actorId: request.userId, action: "creators.coins_converted", entityType: "user", entityId: request.userId, metadata: { coins: request.coins, amount: cash.amountMinor, currency: cash.currency } });
    }
    const after = await creatorWallets.findCreatorCoinBalances(request.userId);
    return { coins: request.coins, cash: cash.toDto(), earnedCoinsRemaining: after.earnedCoins, minimumPayout: minimum.toDto() };
  }

  public describeRevenueRules(currency: CurrencyCode): CreatorRevenueRulesDto {
    const { settings } = this.creatorsService.dependencies;
    const toPercent = (basisPoints: number) => basisPoints / 100;
    return {
      giftCreatorSharePercentUpTo: toPercent(10_000 - settings.liveGiftPlatformCutBps),
      tipCreatorSharePercent: toPercent(10_000 - settings.liveGiftPlatformCutBps),
      subscriptionCreatorSharePercent: toPercent(this.monetization.creators.subscriptionCreatorShareBps),
      adsRevenueCreatorSharePercent: toPercent(this.monetization.creators.adsRevenueCreatorShareBps),
      coinTransferPlatformFeePercent: toPercent(this.monetization.coins.transferFeeBps),
      affiliateCommissionReleasedAfterEscrow: true,
      coinCashValue: calculateCashValueOfCoins(this.monetization, 1, currency).toDto(),
      minimumPayout: Money.of(this.monetization.creators.minimumPayoutMinor, currency).toDto(),
      withdrawalFeeDescription: "Withdrawals pass on the payment provider's bank transfer fee; the exact fee is shown before you confirm.",
    };
  }
}
