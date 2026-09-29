import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { Page } from "../../../../types/pagination.type.js";
import { mapPageItems } from "../../../../utils/pagination.util.js";
import { convertExecutionToDto, type AutomationExecutionDto } from "../../dtos/automation.dto.js";
import type { AutomationRulesService } from "../../services/automationRules.service.js";
import type { ListAutomationExecutionsQuery } from "./listAutomationExecutions.query.js";

export class ListAutomationExecutionsHandler extends QueryHandler<ListAutomationExecutionsQuery, Page<AutomationExecutionDto>> {
  public readonly queryType = "automation.listAutomationExecutions" as const;

  public constructor(private readonly rulesService: AutomationRulesService) {
    super();
  }

  public async execute(query: ListAutomationExecutionsQuery): Promise<Page<AutomationExecutionDto>> {
    const { rules, executions } = this.rulesService.dependencies;
    if ((await rules.findRule(query.ruleId)) === undefined) throw notFound("Automation rule");
    return mapPageItems(await executions.listExecutionsForRule(query.ruleId, query.page), convertExecutionToDto);
  }
}
