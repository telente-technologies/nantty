import { CommandHandler } from "@zudojs/cqrs";

import type { LoyaltyServices } from "../../services/loyaltyServices.service.js";
import type { DeactivateCashbackPromoCommand } from "./deactivateCashbackPromo.command.js";

export class DeactivateCashbackPromoHandler extends CommandHandler<DeactivateCashbackPromoCommand, void> {
  public readonly commandType = "loyalty.deactivateCashbackPromo" as const;

  public constructor(private readonly service: LoyaltyServices) {
    super();
  }

  public execute(command: DeactivateCashbackPromoCommand): Promise<void> {
    return this.service.cashback.deactivatePromo(command.adminId, command.promoId);
  }
}
