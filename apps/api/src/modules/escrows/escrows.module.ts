import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import type { OrdersService } from "../orders/services/orders.service.js";
import { OpenDisputeHandler } from "./commands/openDispute/openDispute.handler.js";
import { PostDisputeMessageHandler } from "./commands/postDisputeMessage/postDisputeMessage.handler.js";
import { ResolveDisputeHandler } from "./commands/resolveDispute/resolveDispute.handler.js";
import { GetDisputeHandler } from "./queries/getDispute/getDispute.handler.js";
import { GetEscrowHandler } from "./queries/getEscrow/getEscrow.handler.js";
import { ListDisputeMessagesHandler } from "./queries/listDisputeMessages/listDisputeMessages.handler.js";
import { ListDisputesHandler } from "./queries/listDisputes/listDisputes.handler.js";
import type { DisputeConversationService } from "./services/disputeConversation.service.js";
import type { DisputesService } from "./services/disputes.service.js";
import type { EscrowsService } from "./services/escrows.service.js";

export class EscrowsModule extends BaseModule {
  public readonly id = "escrows";
  public readonly name = "escrows";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("escrows module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("escrows module stopped");
  }
}

export function registerEscrowsCommandAndQueryHandlers(
  commands: CommandBus,
  queries: QueryBus,
  services: { readonly escrows: EscrowsService; readonly disputes: DisputesService; readonly orders: OrdersService; readonly conversation: DisputeConversationService },
): void {
  registerCommandHandlers(commands, [
    new OpenDisputeHandler(services.disputes),
    new ResolveDisputeHandler(services.disputes),
    new PostDisputeMessageHandler(services.conversation),
  ]);
  registerQueryHandlers(queries, [
    new GetEscrowHandler(services.orders, services.escrows, services.disputes.disputes),
    new ListDisputesHandler(services.disputes),
    new GetDisputeHandler(services.conversation),
    new ListDisputeMessagesHandler(services.conversation),
  ]);
}
