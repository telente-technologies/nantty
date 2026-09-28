import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { JoinWaitlistHandler } from "./commands/joinWaitlist/joinWaitlist.handler.js";
import { CountWaitlistEntriesHandler } from "./queries/countWaitlistEntries/countWaitlistEntries.handler.js";
import { ListWaitlistEntriesHandler } from "./queries/listWaitlistEntries/listWaitlistEntries.handler.js";
import type { WaitlistService } from "./services/waitlist.service.js";

export class WaitlistModule extends BaseModule {
  public readonly id = "waitlist";
  public readonly name = "waitlist";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("waitlist module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("waitlist module stopped");
  }
}

export function registerWaitlistCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, waitlistService: WaitlistService): void {
  registerCommandHandlers(commands, [new JoinWaitlistHandler(waitlistService)]);
  registerQueryHandlers(queries, [new ListWaitlistEntriesHandler(waitlistService), new CountWaitlistEntriesHandler(waitlistService)]);
}
