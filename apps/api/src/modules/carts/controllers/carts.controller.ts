import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { AddCartItemCommand } from "../commands/addCartItem/addCartItem.command.js";
import { ClearCartCommand } from "../commands/clearCart/clearCart.command.js";
import { RemoveCartItemCommand } from "../commands/removeCartItem/removeCartItem.command.js";
import { UpdateCartItemCommand } from "../commands/updateCartItem/updateCartItem.command.js";
import { convertDisplayCartToDto } from "../dtos/carts.dto.js";
import { GetCartQuery } from "../queries/getCart/getCart.query.js";
import type { DisplayCart } from "../services/carts.service.js";
import { AddCartItemBodySchema, CartItemParamsSchema, UpdateCartItemBodySchema } from "../validators/carts.validator.js";

export class CartsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly getCart = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    return this.respondWithCart(ctx, 200);
  };

  public readonly addItem = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = AddCartItemBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    await this.commands.execute<AddCartItemCommand, void>(new AddCartItemCommand(requireAuthenticatedPrincipal(ctx), { productId: body.data.productId, size: body.data.size, color: body.data.color, quantity: body.data.quantity }));
    return this.respondWithCart(ctx, 201);
  };

  public readonly updateItem = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = CartItemParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = UpdateCartItemBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    await this.commands.execute<UpdateCartItemCommand, void>(new UpdateCartItemCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.quantity));
    return this.respondWithCart(ctx, 200);
  };

  public readonly removeItem = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = CartItemParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<RemoveCartItemCommand, void>(new RemoveCartItemCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return this.respondWithCart(ctx, 200);
  };

  public readonly clear = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    await this.commands.execute<ClearCartCommand, void>(new ClearCartCommand(requireAuthenticatedPrincipal(ctx)));
    return this.respondWithCart(ctx, 200);
  };

  private async respondWithCart(ctx: HttpRouterContext, status: number): Promise<HttpResponseContext> {
    const query = new GetCartQuery(requireAuthenticatedPrincipal(ctx), findViewerLocale(ctx).currency);
    const cart = await this.queries.execute<GetCartQuery, DisplayCart>(query);
    return json(status, convertDisplayCartToDto(cart));
  }
}
