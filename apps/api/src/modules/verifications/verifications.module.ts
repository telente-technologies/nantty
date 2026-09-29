import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { ApplyForVerificationHandler } from "./commands/applyForVerification/applyForVerification.handler.js";
import { ReviewVerificationHandler } from "./commands/reviewVerification/reviewVerification.handler.js";
import { GetMyVerificationHandler } from "./queries/getMyVerification/getMyVerification.handler.js";
import { GetVerificationHandler } from "./queries/getVerification/getVerification.handler.js";
import { ListVerificationsHandler } from "./queries/listVerifications/listVerifications.handler.js";
import type { VerificationsService } from "./services/verifications.service.js";

export class VerificationsModule extends BaseModule {
  public readonly id = "verifications";
  public readonly name = "verifications";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("verifications module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("verifications module stopped");
  }
}

export function registerVerificationsCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, service: VerificationsService): void {
  registerCommandHandlers(commands, [new ApplyForVerificationHandler(service), new ReviewVerificationHandler(service)]);
  registerQueryHandlers(queries, [new GetMyVerificationHandler(service), new GetVerificationHandler(service), new ListVerificationsHandler(service)]);
}
