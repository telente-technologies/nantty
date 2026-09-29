import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { AutomationRulesService } from "../../services/automationRules.service.js";
import type { DeleteAutomationRuleCommand } from "./deleteAutomationRule.command.js";

export class DeleteAutomationRuleHandler extends CommandHandler<DeleteAutomationRuleCommand, void> {
  public readonly commandType = "automation.deleteAutomationRule" as const;

  public constructor(private readonly rulesService: AutomationRulesService) {
    super();
  }

  public async execute(command: DeleteAutomationRuleCommand): Promise<void> {
    const { rules, audit } = this.rulesService.dependencies;
    if (!(await rules.deleteRule(command.ruleId))) throw notFound("Automation rule");
    await audit.record({ actorId: command.principal.userId, action: "automation.rule_deleted", entityType: "automation_rule", entityId: command.ruleId });
  }
}
