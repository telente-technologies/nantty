import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { TakeActionBody } from "../../validators/moderation.validator.js";

export class TakeModerationActionCommand extends Command<"moderation.takeModerationAction"> {
  public constructor(
    public readonly principal: Principal,
    public readonly caseId: string,
    public readonly input: TakeActionBody,
  ) {
    super("moderation.takeModerationAction");
  }
}
