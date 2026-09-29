import { CommandHandler } from "@zudojs/cqrs";

import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { RemoveBrandDealCommand } from "./removeBrandDeal.command.js";

export class RemoveBrandDealHandler extends CommandHandler<RemoveBrandDealCommand, void> {
  public readonly commandType = "creators.removeBrandDeal" as const;

  public constructor(private readonly service: CreatorProgramServices) {
    super();
  }

  public execute(command: RemoveBrandDealCommand): Promise<void> {
    return this.service.brandDeals.removeBrandDeal(command.creatorId, command.dealId);
  }
}
