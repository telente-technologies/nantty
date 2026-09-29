import { ServiceUnavailableError } from "@zudojs/errors";

import type { BlueVerificationTier, PersonalVerificationLookup } from "../../../interfaces/creatorEligibility.interface.js";
import type { CreatorCoinBalances, CreatorCoinPaymentReceipt, CreatorWallets, UserWalletSummary } from "../../../interfaces/creatorWallets.interface.js";

export class UnavailableCreatorWallets implements CreatorWallets {
  public async payForLiveGift(): Promise<CreatorCoinPaymentReceipt> {
    throw new ServiceUnavailableError("Gift payments are not available yet.");
  }

  public async findCreatorCoinBalances(): Promise<CreatorCoinBalances> {
    return { spendableCoins: 0, earnedCoins: 0 };
  }

  public async convertEarnedCoinsToCash(): Promise<{ readonly created: boolean }> {
    throw new ServiceUnavailableError("Creator wallets are not available yet.");
  }

  public async creditAffiliateCommission(): Promise<void> {
    throw new ServiceUnavailableError("Creator wallets are not available yet.");
  }

  public async findUserWalletSummary(userId: string): Promise<UserWalletSummary> {
    return { userId, balances: [] };
  }
}

export class NoPublicBlueVerification implements PersonalVerificationLookup {
  public async findPublicBlueTier(): Promise<BlueVerificationTier | null> {
    return null;
  }
}
