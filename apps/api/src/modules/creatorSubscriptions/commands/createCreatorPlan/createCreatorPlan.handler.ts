import { CommandHandler } from "@zudojs/cqrs";

import type { CreatorPlanDto } from "../../dtos/creatorSubscriptions.dto.js";
import type { CreatorSubscriptionsServices } from "../../services/creatorSubscriptionsServices.service.js";
import type { CreateCreatorPlanCommand } from "./createCreatorPlan.command.js";

export class CreateCreatorPlanHandler extends CommandHandler<CreateCreatorPlanCommand, CreatorPlanDto> {
  public readonly commandType = "creatorSubscriptions.createCreatorPlan" as const;

  public constructor(private readonly service: CreatorSubscriptionsServices) {
    super();
  }

  public execute(command: CreateCreatorPlanCommand): Promise<CreatorPlanDto> {
    return this.service.plans.createPlan(command.creatorId, command.input);
  }
}
