import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class DeleteAutomationRuleCommand extends Command<"automation.deleteAutomationRule"> {
  public constructor(
    public readonly principal: Principal,
    public readonly ruleId: string,
  ) {
    super("automation.deleteAutomationRule");
  }
}
