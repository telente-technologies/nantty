import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { RecordAuditEventHandler } from "./commands/recordAuditEvent/recordAuditEvent.handler.js";
import { GetAuditEventHandler } from "./queries/getAuditEvent/getAuditEvent.handler.js";
import { ListAuditEventsHandler } from "./queries/listAuditEvents/listAuditEvents.handler.js";
import type { AuditService } from "./services/audit.service.js";

export class AuditModule extends BaseModule {
  public readonly id = "audit";
  public readonly name = "audit";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("audit module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("audit module stopped");
  }
}

export function registerAuditCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, auditService: AuditService): void {
  registerCommandHandlers(commands, [new RecordAuditEventHandler(auditService)]);
  registerQueryHandlers(queries, [new GetAuditEventHandler(auditService), new ListAuditEventsHandler(auditService)]);
}
