import { Command } from "@zudojs/cqrs";

import type { CreatorPlanUpdateInput } from "../../services/creatorPlans.service.js";

export class UpdateCreatorPlanCommand extends Command<"creatorSubscriptions.updateCreatorPlan"> {
  public constructor(
    public readonly creatorId: string,
    public readonly planId: string,
    public readonly input: CreatorPlanUpdateInput,
  ) {
    super("creatorSubscriptions.updateCreatorPlan");
  }
}
