import { CommandHandler } from "@zudojs/cqrs";

import type { CreatorPlanDto } from "../../dtos/creatorSubscriptions.dto.js";
import type { CreatorSubscriptionsServices } from "../../services/creatorSubscriptionsServices.service.js";
import type { UpdateCreatorPlanCommand } from "./updateCreatorPlan.command.js";

export class UpdateCreatorPlanHandler extends CommandHandler<UpdateCreatorPlanCommand, CreatorPlanDto> {
  public readonly commandType = "creatorSubscriptions.updateCreatorPlan" as const;

  public constructor(private readonly service: CreatorSubscriptionsServices) {
    super();
  }

  public execute(command: UpdateCreatorPlanCommand): Promise<CreatorPlanDto> {
    return this.service.plans.updatePlan(command.creatorId, command.planId, command.input);
  }
}
