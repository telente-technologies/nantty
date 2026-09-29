import { CommandHandler } from "@zudojs/cqrs";

import type { LoyaltyServices } from "../../services/loyaltyServices.service.js";
import type { ReleaseCheckoutPointsCommand } from "./releaseCheckoutPoints.command.js";

export class ReleaseCheckoutPointsHandler extends CommandHandler<ReleaseCheckoutPointsCommand, void> {
  public readonly commandType = "loyalty.releaseCheckoutPoints" as const;

  public constructor(private readonly service: LoyaltyServices) {
    super();
  }

  public execute(command: ReleaseCheckoutPointsCommand): Promise<void> {
    return this.service.points.releaseRedemption(command.userId, command.checkoutId);
  }
}
