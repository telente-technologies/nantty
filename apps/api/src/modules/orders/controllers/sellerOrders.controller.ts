import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { MarkOrderDeliveredCommand } from "../commands/markOrderDelivered/markOrderDelivered.command.js";
import { MarkOrderShippedCommand } from "../commands/markOrderShipped/markOrderShipped.command.js";
import { convertOrderToDto, keepNativeCurrency } from "../dtos/orders.dto.js";
import type { OrderRecord } from "../models/orders.model.js";
import { GetStoreDashboardQuery } from "../queries/getStoreDashboard/getStoreDashboard.query.js";
import { GetStoreOrderQuery } from "../queries/getStoreOrder/getStoreOrder.query.js";
import { ListStoreOrdersQuery } from "../queries/listStoreOrders/listStoreOrders.query.js";
import type { OrdersService } from "../services/orders.service.js";
import type { StoreDashboard } from "../services/storeDashboard.service.js";
import { ListSellerOrdersQuerySchema, OrderParamsSchema, SellerDashboardQuerySchema, ShipOrderBodySchema } from "../validators/orders.validator.js";

export class SellerOrdersController {
  public constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    private readonly ordersService: OrdersService,
  ) {}

  public readonly list = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListSellerOrdersQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { status, q, storeId, ...page } = query.data;
    const result = await this.queries.execute<ListStoreOrdersQuery, Page<OrderRecord>>(
      new ListStoreOrdersQuery(requireAuthenticatedPrincipal(ctx), storeId, status === "all" ? undefined : status, q, buildPageRequest(page)),
    );
    return json(200, { data: await this.convertOrdersInStoreCurrency(result.data), nextCursor: result.nextCursor });
  };

  public readonly get = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = OrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const order = await this.queries.execute<GetStoreOrderQuery, OrderRecord>(new GetStoreOrderQuery(requireAuthenticatedPrincipal(ctx), params.data.id));
    return json(200, (await this.convertOrdersInStoreCurrency([order]))[0]);
  };

  public readonly ship = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = OrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = ShipOrderBodySchema.safeParse(readJsonBody(ctx) ?? {});
    if (!body.success) return validationFailed(body.issues);
    const command = new MarkOrderShippedCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.trackingNumber ?? null, body.data.courier ?? null);
    return json(200, (await this.convertOrdersInStoreCurrency([await this.commands.execute<MarkOrderShippedCommand, OrderRecord>(command)]))[0]);
  };

  public readonly deliver = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = OrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new MarkOrderDeliveredCommand(requireAuthenticatedPrincipal(ctx), params.data.id);
    return json(200, (await this.convertOrdersInStoreCurrency([await this.commands.execute<MarkOrderDeliveredCommand, OrderRecord>(command)]))[0]);
  };

  public readonly dashboard = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = SellerDashboardQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const dashboard = await this.queries.execute<GetStoreDashboardQuery, StoreDashboard>(
      new GetStoreDashboardQuery(requireAuthenticatedPrincipal(ctx), query.data.storeId, query.data.period ?? "today"),
    );
    return json(200, { ...dashboard, recentOrders: await this.convertOrdersInStoreCurrency(dashboard.recentOrders) });
  };

  private convertOrdersInStoreCurrency(orders: readonly OrderRecord[]) {
    return Promise.all(orders.map(async (order) => convertOrderToDto(order, await this.ordersService.decryptShippingPhone(order), keepNativeCurrency)));
  }
}
