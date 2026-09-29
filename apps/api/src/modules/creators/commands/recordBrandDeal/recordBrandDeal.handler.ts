import { CommandHandler } from "@zudojs/cqrs";

import type { BrandDealDto } from "../../dtos/creators.dto.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { RecordBrandDealCommand } from "./recordBrandDeal.command.js";

export class RecordBrandDealHandler extends CommandHandler<RecordBrandDealCommand, BrandDealDto> {
  public readonly commandType = "creators.recordBrandDeal" as const;

  public constructor(private readonly service: CreatorProgramServices) {
    super();
  }

  public execute(command: RecordBrandDealCommand): Promise<BrandDealDto> {
    return this.service.brandDeals.recordBrandDeal(command.creatorId, command.input);
  }
}
