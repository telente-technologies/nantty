import { CommandHandler } from "@zudojs/cqrs";

import { convertRuleToDto, type AutomationRuleDto } from "../../dtos/automation.dto.js";
import type { AutomationRulesService } from "../../services/automationRules.service.js";
import type { CreateAutomationRuleCommand } from "./createAutomationRule.command.js";

export class CreateAutomationRuleHandler extends CommandHandler<CreateAutomationRuleCommand, AutomationRuleDto> {
  public readonly commandType = "automation.createAutomationRule" as const;

  public constructor(private readonly rulesService: AutomationRulesService) {
    super();
  }

  public async execute(command: CreateAutomationRuleCommand): Promise<AutomationRuleDto> {
    const { rules, audit, clock, defaultExecutionsPerHour } = this.rulesService.dependencies;
    const { input } = command;
    const rule = await rules.createRule(
      {
        name: input.name.trim(),
        description: input.description?.trim() ?? "",
        trigger: input.trigger,
        conditions: input.conditions ?? [],
        actions: input.actions,
        threshold: input.threshold ?? null,
        cooldownSeconds: input.cooldownSeconds ?? null,
        maxExecutionsPerHour: input.maxExecutionsPerHour ?? defaultExecutionsPerHour,
        enabled: input.enabled ?? true,
        createdById: command.principal.userId,
      },
      clock.now(),
    );
    await audit.record({ actorId: command.principal.userId, action: "automation.rule_created", entityType: "automation_rule", entityId: rule.id, metadata: { trigger: rule.trigger } });
    return convertRuleToDto(rule);
  }
}
