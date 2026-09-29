import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import type { EscrowRecord } from "../../escrows/models/escrows.model.js";
import { convertEscrowToDto } from "../../escrows/dtos/escrows.dto.js";
import { CancelOrderCommand } from "../commands/cancelOrder/cancelOrder.command.js";
import { CheckoutCommand } from "../commands/checkout/checkout.command.js";
import { ConfirmOrderReceiptCommand } from "../commands/confirmOrderReceipt/confirmOrderReceipt.command.js";
import { MarkOrderDeliveredCommand } from "../commands/markOrderDelivered/markOrderDelivered.command.js";
import { MarkOrderShippedCommand } from "../commands/markOrderShipped/markOrderShipped.command.js";
import { convertCheckoutToDto, convertOrderToDto } from "../dtos/orders.dto.js";
import type { OrderRecord } from "../models/orders.model.js";
import { GetOrderQuery } from "../queries/getOrder/getOrder.query.js";
import { GetStoreDashboardQuery } from "../queries/getStoreDashboard/getStoreDashboard.query.js";
import { GetStoreOrderQuery } from "../queries/getStoreOrder/getStoreOrder.query.js";
import { ListMyOrdersQuery } from "../queries/listMyOrders/listMyOrders.query.js";
import { ListStoreOrdersQuery } from "../queries/listStoreOrders/listStoreOrders.query.js";
import type { CheckoutResult, OrdersService } from "../services/orders.service.js";
import type { StoreDashboard } from "../services/storeDashboard.service.js";
import {
  CheckoutBodySchema,
  ListBuyerOrdersQuerySchema,
  ListStoreOrdersQuerySchema,
  OrderParamsSchema,
  ShipOrderBodySchema,
  StoreOrderParamsSchema,
  StoreParamsSchema,
} from "../validators/orders.validator.js";

export class OrdersController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus, private readonly ordersService: OrdersService) {}

  public readonly checkout = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = CheckoutBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const result = await this.commands.execute<CheckoutCommand, CheckoutResult>(new CheckoutCommand(requireAuthenticatedPrincipal(ctx), body.data.shippingAddress));
    return json(201, { checkout: convertCheckoutToDto(result.checkout), orders: await this.convertOrders(result.orders) });
  };

  public readonly listMine = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListBuyerOrdersQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { status, ...page } = query.data;
    const result = await this.queries.execute<ListMyOrdersQuery, Page<OrderRecord>>(
      new ListMyOrdersQuery(requireAuthenticatedPrincipal(ctx), status ?? "all", buildPageRequest(page)),
    );
    return json(200, { items: await this.convertOrders(result.items), nextCursor: result.nextCursor });
  };

  public readonly getMine = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = OrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const order = await this.queries.execute<GetOrderQuery, OrderRecord>(new GetOrderQuery(requireAuthenticatedPrincipal(ctx), params.data.id));
    return json(200, await this.convertOrder(order));
  };

  public readonly cancel = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = OrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const order = await this.commands.execute<CancelOrderCommand, OrderRecord>(new CancelOrderCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return json(200, await this.convertOrder(order));
  };

  public readonly confirmReceipt = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = OrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const escrow = await this.commands.execute<ConfirmOrderReceiptCommand, EscrowRecord>(new ConfirmOrderReceiptCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return json(200, { escrow: convertEscrowToDto(escrow) });
  };

  public readonly listStoreOrders = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = ListStoreOrdersQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { status, ...page } = query.data;
    const result = await this.queries.execute<ListStoreOrdersQuery, Page<OrderRecord>>(
      new ListStoreOrdersQuery(requireAuthenticatedPrincipal(ctx), params.data.storeId, status === undefined ? undefined : [status], buildPageRequest(page)),
    );
    return json(200, { items: await this.convertOrders(result.items), nextCursor: result.nextCursor });
  };

  public readonly getStoreOrder = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreOrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = new GetStoreOrderQuery(requireAuthenticatedPrincipal(ctx), params.data.storeId, params.data.id);
    return json(200, await this.convertOrder(await this.queries.execute<GetStoreOrderQuery, OrderRecord>(query)));
  };

  public readonly ship = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreOrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = ShipOrderBodySchema.safeParse(readJsonBody(ctx) ?? {});
    if (!body.success) return validationFailed(body.issues);
    const command = new MarkOrderShippedCommand(requireAuthenticatedPrincipal(ctx), params.data.storeId, params.data.id, body.data.trackingNumber ?? null);
    return json(200, await this.convertOrder(await this.commands.execute<MarkOrderShippedCommand, OrderRecord>(command)));
  };

  public readonly deliver = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreOrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new MarkOrderDeliveredCommand(requireAuthenticatedPrincipal(ctx), params.data.storeId, params.data.id);
    return json(200, await this.convertOrder(await this.commands.execute<MarkOrderDeliveredCommand, OrderRecord>(command)));
  };

  public readonly dashboard = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const dashboard = await this.queries.execute<GetStoreDashboardQuery, StoreDashboard>(new GetStoreDashboardQuery(requireAuthenticatedPrincipal(ctx), params.data.storeId));
    return json(200, { ...dashboard, recentOrders: await this.convertOrders(dashboard.recentOrders) });
  };

  private async convertOrder(order: OrderRecord) {
    return convertOrderToDto(order, await this.ordersService.decryptShippingPhone(order));
  }

  private convertOrders(orders: readonly OrderRecord[]) {
    return Promise.all(orders.map((order) => this.convertOrder(order)));
  }
}
