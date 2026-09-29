import { Command } from "@zudojs/cqrs";

import type { NewCreatorPlanInput } from "../../services/creatorPlans.service.js";

export class CreateCreatorPlanCommand extends Command<"creatorSubscriptions.createCreatorPlan"> {
  public constructor(
    public readonly creatorId: string,
    public readonly input: NewCreatorPlanInput,
  ) {
    super("creatorSubscriptions.createCreatorPlan");
  }
}
