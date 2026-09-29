import { CommandHandler } from "@zudojs/cqrs";

import type { LoyaltyServices } from "../../services/loyaltyServices.service.js";
import type { PointsRedemptionRecord } from "../../models/loyalty.model.js";
import type { RedeemCheckoutPointsCommand } from "./redeemCheckoutPoints.command.js";

export class RedeemCheckoutPointsHandler extends CommandHandler<RedeemCheckoutPointsCommand, PointsRedemptionRecord> {
  public readonly commandType = "loyalty.redeemCheckoutPoints" as const;

  public constructor(private readonly service: LoyaltyServices) {
    super();
  }

  public execute(command: RedeemCheckoutPointsCommand): Promise<PointsRedemptionRecord> {
    return this.service.points.redeemPointsAtCheckout(command.userId, command.checkoutId, command.points);
  }
}
