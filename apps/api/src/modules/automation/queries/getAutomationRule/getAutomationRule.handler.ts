import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { convertRuleToDto, type AutomationRuleDto } from "../../dtos/automation.dto.js";
import type { AutomationRulesService } from "../../services/automationRules.service.js";
import type { GetAutomationRuleQuery } from "./getAutomationRule.query.js";

export class GetAutomationRuleHandler extends QueryHandler<GetAutomationRuleQuery, AutomationRuleDto> {
  public readonly queryType = "automation.getAutomationRule" as const;

  public constructor(private readonly rulesService: AutomationRulesService) {
    super();
  }

  public async execute(query: GetAutomationRuleQuery): Promise<AutomationRuleDto> {
    const rule = await this.rulesService.dependencies.rules.findRule(query.ruleId);
    if (rule === undefined) throw notFound("Automation rule");
    return convertRuleToDto(rule);
  }
}
