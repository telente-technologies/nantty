import { ServiceUnavailableError } from "@zudojs/errors";

import type { BlueVerificationTier, PersonalVerificationLookup } from "../../../interfaces/creatorEligibility.interface.js";
import type { CreatorWallets, UserWalletSummary } from "../../../interfaces/creatorWallets.interface.js";

export class UnavailableCreatorWallets implements CreatorWallets {
  public async payForLiveGift(): Promise<void> {
    throw new ServiceUnavailableError("Gift payments are not available yet.");
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
