import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { ResolveAppealHandler } from "./commands/resolveAppeal/resolveAppeal.handler.js";
import { SubmitAppealHandler } from "./commands/submitAppeal/submitAppeal.handler.js";
import { SubmitReportHandler } from "./commands/submitReport/submitReport.handler.js";
import { TakeModerationActionHandler } from "./commands/takeModerationAction/takeModerationAction.handler.js";
import { GetModerationCaseHandler } from "./queries/getModerationCase/getModerationCase.handler.js";
import { ListModerationAppealsHandler } from "./queries/listModerationAppeals/listModerationAppeals.handler.js";
import { ListModerationCasesHandler } from "./queries/listModerationCases/listModerationCases.handler.js";
import { ListMyModerationDecisionsHandler } from "./queries/listMyModerationDecisions/listMyModerationDecisions.handler.js";
import { ListMyReportsHandler } from "./queries/listMyReports/listMyReports.handler.js";
import type { ModerationEnforcementService } from "./services/moderationEnforcement.service.js";
import type { ModerationService } from "./services/moderation.service.js";

export class ModerationModule extends BaseModule {
  public readonly id = "moderation";
  public readonly name = "moderation";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("moderation module initialized");
  }
}

export function registerModerationCommandAndQueryHandlers(
  commands: CommandBus,
  queries: QueryBus,
  moderationService: ModerationService,
  enforcement: ModerationEnforcementService,
): void {
  registerCommandHandlers(commands, [
    new SubmitReportHandler(moderationService),
    new TakeModerationActionHandler(moderationService, enforcement),
    new SubmitAppealHandler(moderationService),
    new ResolveAppealHandler(moderationService, enforcement),
  ]);
  registerQueryHandlers(queries, [
    new ListMyReportsHandler(moderationService),
    new ListMyModerationDecisionsHandler(moderationService),
    new ListModerationCasesHandler(moderationService),
    new GetModerationCaseHandler(moderationService),
    new ListModerationAppealsHandler(moderationService),
  ]);
}
