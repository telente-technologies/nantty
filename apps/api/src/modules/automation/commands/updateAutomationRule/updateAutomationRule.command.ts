import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { UpdateRuleBody } from "../../validators/automation.validator.js";

export class UpdateAutomationRuleCommand extends Command<"automation.updateAutomationRule"> {
  public constructor(
    public readonly principal: Principal,
    public readonly ruleId: string,
    public readonly input: UpdateRuleBody,
  ) {
    super("automation.updateAutomationRule");
  }
}
