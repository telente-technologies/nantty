import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { CreateAutomationRuleHandler } from "./commands/createAutomationRule/createAutomationRule.handler.js";
import { DeleteAutomationRuleHandler } from "./commands/deleteAutomationRule/deleteAutomationRule.handler.js";
import { UpdateAutomationRuleHandler } from "./commands/updateAutomationRule/updateAutomationRule.handler.js";
import { GetAutomationRuleHandler } from "./queries/getAutomationRule/getAutomationRule.handler.js";
import { ListAutomationExecutionsHandler } from "./queries/listAutomationExecutions/listAutomationExecutions.handler.js";
import { ListAutomationRulesHandler } from "./queries/listAutomationRules/listAutomationRules.handler.js";
import type { AutomationRulesService } from "./services/automationRules.service.js";

export class AutomationModule extends BaseModule {
  public readonly id = "automation";
  public readonly name = "automation";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("automation module initialized");
  }
}

export function registerAutomationCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, rulesService: AutomationRulesService): void {
  registerCommandHandlers(commands, [
    new CreateAutomationRuleHandler(rulesService),
    new UpdateAutomationRuleHandler(rulesService),
    new DeleteAutomationRuleHandler(rulesService),
  ]);
  registerQueryHandlers(queries, [
    new ListAutomationRulesHandler(rulesService),
    new GetAutomationRuleHandler(rulesService),
    new ListAutomationExecutionsHandler(rulesService),
  ]);
}
