import { CommandHandler } from "@zudojs/cqrs";

import type { CashbackPromoRecord } from "../../models/loyalty.model.js";
import type { LoyaltyServices } from "../../services/loyaltyServices.service.js";
import type { CreateCashbackPromoCommand } from "./createCashbackPromo.command.js";

export class CreateCashbackPromoHandler extends CommandHandler<CreateCashbackPromoCommand, CashbackPromoRecord> {
  public readonly commandType = "loyalty.createCashbackPromo" as const;

  public constructor(private readonly service: LoyaltyServices) {
    super();
  }

  public execute(command: CreateCashbackPromoCommand): Promise<CashbackPromoRecord> {
    return this.service.cashback.createPromo(command.adminId, command.input);
  }
}
