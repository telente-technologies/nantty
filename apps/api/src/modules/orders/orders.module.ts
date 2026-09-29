import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import type { EscrowsService } from "../escrows/services/escrows.service.js";
import { CancelOrderHandler } from "./commands/cancelOrder/cancelOrder.handler.js";
import type { CheckoutDiscountSource } from "../payments/services/checkoutDiscounts.service.js";
import { CheckoutHandler } from "./commands/checkout/checkout.handler.js";
import { ConfirmOrderReceiptHandler } from "./commands/confirmOrderReceipt/confirmOrderReceipt.handler.js";
import { MarkOrderDeliveredHandler } from "./commands/markOrderDelivered/markOrderDelivered.handler.js";
import { MarkOrderShippedHandler } from "./commands/markOrderShipped/markOrderShipped.handler.js";
import { GetOrderHandler } from "./queries/getOrder/getOrder.handler.js";
import { GetStoreDashboardHandler } from "./queries/getStoreDashboard/getStoreDashboard.handler.js";
import { GetStoreOrderHandler } from "./queries/getStoreOrder/getStoreOrder.handler.js";
import { ListMyOrdersHandler } from "./queries/listMyOrders/listMyOrders.handler.js";
import { ListStoreOrdersHandler } from "./queries/listStoreOrders/listStoreOrders.handler.js";
import type { OrdersService } from "./services/orders.service.js";
import type { StoreDashboardService } from "./services/storeDashboard.service.js";

export class OrdersModule extends BaseModule {
  public readonly id = "orders";
  public readonly name = "orders";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("orders module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("orders module stopped");
  }
}

export function registerOrdersCommandAndQueryHandlers(
  commands: CommandBus,
  queries: QueryBus,
  services: { readonly orders: OrdersService; readonly dashboard: StoreDashboardService; readonly escrows: EscrowsService; readonly checkoutDiscounts?: CheckoutDiscountSource },
): void {
  registerCommandHandlers(commands, [
    new CheckoutHandler(services.orders, services.checkoutDiscounts),
    new CancelOrderHandler(services.orders),
    new MarkOrderShippedHandler(services.orders),
    new MarkOrderDeliveredHandler(services.orders, services.escrows),
    new ConfirmOrderReceiptHandler(services.orders, services.escrows),
  ]);
  registerQueryHandlers(queries, [
    new GetOrderHandler(services.orders),
    new GetStoreOrderHandler(services.orders),
    new ListMyOrdersHandler(services.orders),
    new ListStoreOrdersHandler(services.orders),
    new GetStoreDashboardHandler(services.dashboard),
  ]);
}
