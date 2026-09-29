import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { convertRuleToDto, type AutomationRuleDto } from "../../dtos/automation.dto.js";
import type { AutomationRuleChanges } from "../../models/automation.model.js";
import type { AutomationRulesService } from "../../services/automationRules.service.js";
import type { UpdateAutomationRuleCommand } from "./updateAutomationRule.command.js";

export class UpdateAutomationRuleHandler extends CommandHandler<UpdateAutomationRuleCommand, AutomationRuleDto> {
  public readonly commandType = "automation.updateAutomationRule" as const;

  public constructor(private readonly rulesService: AutomationRulesService) {
    super();
  }

  public async execute(command: UpdateAutomationRuleCommand): Promise<AutomationRuleDto> {
    const { rules, audit, clock } = this.rulesService.dependencies;
    const { name, description, ...rest } = command.input;
    const changes: AutomationRuleChanges = {
      ...Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)),
      ...(name === undefined ? {} : { name: name.trim() }),
      ...(description === undefined ? {} : { description: description.trim() }),
    };
    const updated = await rules.updateRule(command.ruleId, changes, clock.now());
    if (updated === undefined) throw notFound("Automation rule");
    await audit.record({ actorId: command.principal.userId, action: "automation.rule_updated", entityType: "automation_rule", entityId: updated.id, metadata: { fields: Object.keys(changes) } });
    return convertRuleToDto(updated);
  }
}
