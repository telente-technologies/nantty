import { Command } from "@zudojs/cqrs";

import type { CreateRuleBody } from "../../validators/automation.validator.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CreateAutomationRuleCommand extends Command<"automation.createAutomationRule"> {
  public constructor(
    public readonly principal: Principal,
    public readonly input: CreateRuleBody,
  ) {
    super("automation.createAutomationRule");
  }
}
