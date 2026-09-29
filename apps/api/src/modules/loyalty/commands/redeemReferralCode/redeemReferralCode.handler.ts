import { CommandHandler } from "@zudojs/cqrs";

import type { LoyaltyServices } from "../../services/loyaltyServices.service.js";
import type { ReferralRecord } from "../../models/loyalty.model.js";
import type { RedeemReferralCodeCommand } from "./redeemReferralCode.command.js";

export class RedeemReferralCodeHandler extends CommandHandler<RedeemReferralCodeCommand, ReferralRecord> {
  public readonly commandType = "loyalty.redeemReferralCode" as const;

  public constructor(private readonly service: LoyaltyServices) {
    super();
  }

  public execute(command: RedeemReferralCodeCommand): Promise<ReferralRecord> {
    return this.service.referrals.redeemCode(command.userId, command.code);
  }
}
