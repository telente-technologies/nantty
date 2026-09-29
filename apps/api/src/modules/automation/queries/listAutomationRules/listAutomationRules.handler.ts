import { QueryHandler } from "@zudojs/cqrs";

import { convertRuleToDto, type AutomationRuleDto } from "../../dtos/automation.dto.js";
import type { AutomationRulesService } from "../../services/automationRules.service.js";
import type { ListAutomationRulesQuery } from "./listAutomationRules.query.js";

export class ListAutomationRulesHandler extends QueryHandler<ListAutomationRulesQuery, readonly AutomationRuleDto[]> {
  public readonly queryType = "automation.listAutomationRules" as const;

  public constructor(private readonly rulesService: AutomationRulesService) {
    super();
  }

  public async execute(): Promise<readonly AutomationRuleDto[]> {
    return (await this.rulesService.dependencies.rules.listRules()).map(convertRuleToDto);
  }
}
