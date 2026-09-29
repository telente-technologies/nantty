import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import type { CurrencyConverter, MoneyConversion } from "../../../interfaces/currencyConverter.interface.js";
import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { Money } from "../../../utils/money.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { convertEscrowToDto } from "../../escrows/dtos/escrows.dto.js";
import type { EscrowRecord } from "../../escrows/models/escrows.model.js";
import { CancelOrderCommand } from "../commands/cancelOrder/cancelOrder.command.js";
import { CheckoutCommand } from "../commands/checkout/checkout.command.js";
import { ConfirmOrderReceiptCommand } from "../commands/confirmOrderReceipt/confirmOrderReceipt.command.js";
import { convertOrderToDto } from "../dtos/orders.dto.js";
import type { OrderRecord } from "../models/orders.model.js";
import { GetOrderQuery } from "../queries/getOrder/getOrder.query.js";
import { ListMyOrdersQuery } from "../queries/listMyOrders/listMyOrders.query.js";
import type { CheckoutResult, OrdersService } from "../services/orders.service.js";
import { CheckoutBodySchema, ListBuyerOrdersQuerySchema, OrderParamsSchema } from "../validators/orders.validator.js";

export class OrdersController {
  public constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    private readonly ordersService: OrdersService,
    private readonly currencyConverter: CurrencyConverter,
  ) {}

  public readonly checkout = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = CheckoutBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new CheckoutCommand(requireAuthenticatedPrincipal(ctx), body.data.addressId, findViewerLocale(ctx).currency);
    const result = await this.commands.execute<CheckoutCommand, CheckoutResult>(command);
    return json(201, {
      orders: await this.convertOrdersForBuyer(ctx, result.orders),
      payableOrderId: result.orders[0]?.id ?? null,
      checkoutId: result.checkout.id,
      total: Money.of(result.checkout.total, result.checkout.currency).toDto(),
    });
  };

  public readonly listMine = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListBuyerOrdersQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { status, ...page } = query.data;
    const result = await this.queries.execute<ListMyOrdersQuery, Page<OrderRecord>>(
      new ListMyOrdersQuery(requireAuthenticatedPrincipal(ctx), status === "all" ? undefined : status, buildPageRequest(page)),
    );
    return json(200, { data: await this.convertOrdersForBuyer(ctx, result.data), nextCursor: result.nextCursor });
  };

  public readonly getMine = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = OrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const order = await this.queries.execute<GetOrderQuery, OrderRecord>(new GetOrderQuery(requireAuthenticatedPrincipal(ctx), params.data.id));
    return json(200, (await this.convertOrdersForBuyer(ctx, [order]))[0]);
  };

  public readonly cancel = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = OrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const order = await this.commands.execute<CancelOrderCommand, OrderRecord>(new CancelOrderCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return json(200, (await this.convertOrdersForBuyer(ctx, [order]))[0]);
  };

  public readonly confirmReceipt = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = OrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new ConfirmOrderReceiptCommand(requireAuthenticatedPrincipal(ctx), params.data.id);
    const escrow = await this.commands.execute<ConfirmOrderReceiptCommand, EscrowRecord>(command);
    return json(200, { escrow: convertEscrowToDto(escrow) });
  };

  private async convertOrdersForBuyer(ctx: HttpRouterContext, orders: readonly OrderRecord[]) {
    const convert: MoneyConversion = await this.currencyConverter.prepareConversionInto(findViewerLocale(ctx).currency);
    return Promise.all(orders.map(async (order) => convertOrderToDto(order, await this.ordersService.decryptShippingPhone(order), convert)));
  }
}
