import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import type { InventoryLine } from "../../../interfaces/productCatalog.interface.js";
import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { AddProductVariantCommand } from "../commands/addProductVariant/addProductVariant.command.js";
import { AdjustInventoryCommand } from "../commands/adjustInventory/adjustInventory.command.js";
import { CreateProductCommand } from "../commands/createProduct/createProduct.command.js";
import { DeleteProductCommand } from "../commands/deleteProduct/deleteProduct.command.js";
import { PublishProductCommand } from "../commands/publishProduct/publishProduct.command.js";
import { UnpublishProductCommand } from "../commands/unpublishProduct/unpublishProduct.command.js";
import { UpdateProductCommand } from "../commands/updateProduct/updateProduct.command.js";
import { UpdateProductVariantCommand } from "../commands/updateProductVariant/updateProductVariant.command.js";
import { keepNativeCurrency } from "../dtos/price.dto.js";
import { convertProductToDetailDto, convertVariantToDto, describeStockLevel, type ProductDetailDto } from "../dtos/products.dto.js";
import type { ProductWithVariants, VariantOfProduct } from "../models/products.model.js";
import { GetStoreProductQuery } from "../queries/getStoreProduct/getStoreProduct.query.js";
import { ListStoreInventoryQuery } from "../queries/listStoreInventory/listStoreInventory.query.js";
import { ListStoreProductsQuery } from "../queries/listStoreProducts/listStoreProducts.query.js";
import { ResolveSellerStoreQuery } from "../queries/resolveSellerStore/resolveSellerStore.query.js";
import {
  AdjustInventoryBodySchema,
  CreateProductBodySchema,
  SellerProductPageQuerySchema,
  SellerProductParamsSchema,
  SellerScopeQuerySchema,
  SellerVariantParamsSchema,
  UpdateProductBodySchema,
  UpdateVariantBodySchema,
  VariantBodySchema,
} from "../validators/products.validator.js";

function respondWithProduct(status: number, result: ProductWithVariants): HttpResponseContext {
  return json(status, convertProductToDetailDto(result.product, result.variants, keepNativeCurrency));
}

function acceptNameAsTitle(body: unknown): unknown {
  if (typeof body !== "object" || body === null) return body;
  const record = body as Record<string, unknown>;
  return record["title"] === undefined && typeof record["name"] === "string" ? { ...record, title: record["name"] } : body;
}

export class SellerProductsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly list = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = SellerProductPageQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const storeId = await this.resolveStoreId(ctx, query.data.storeId, undefined);
    const listQuery = new ListStoreProductsQuery(requireAuthenticatedPrincipal(ctx), storeId, buildPageRequest(query.data));
    return json(200, await this.queries.execute<ListStoreProductsQuery, Page<ProductDetailDto>>(listQuery));
  };

  public readonly inventory = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const scope = SellerScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    const storeId = await this.resolveStoreId(ctx, scope.data.storeId, undefined);
    const lines = await this.queries.execute<ListStoreInventoryQuery, readonly InventoryLine[]>(new ListStoreInventoryQuery(requireAuthenticatedPrincipal(ctx), storeId));
    return json(200, lines.map((line) => ({ ...line, stockLabel: describeStockLevel(line.stock) })));
  };

  public readonly create = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const scope = SellerScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    const body = CreateProductBodySchema.safeParse(acceptNameAsTitle(readJsonBody(ctx)));
    if (!body.success) return validationFailed(body.issues);
    const storeId = await this.resolveStoreId(ctx, scope.data.storeId, undefined);
    const command = new CreateProductCommand(requireAuthenticatedPrincipal(ctx), storeId, body.data);
    return respondWithProduct(201, await this.commands.execute<CreateProductCommand, ProductWithVariants>(command));
  };

  public readonly get = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = SellerProductParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const storeId = await this.resolveStoreId(ctx, undefined, params.data.id);
    const query = new GetStoreProductQuery(requireAuthenticatedPrincipal(ctx), storeId, params.data.id);
    return respondWithProduct(200, await this.queries.execute<GetStoreProductQuery, ProductWithVariants>(query));
  };

  public readonly update = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = SellerProductParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = UpdateProductBodySchema.safeParse(acceptNameAsTitle(readJsonBody(ctx)));
    if (!body.success) return validationFailed(body.issues);
    const storeId = await this.resolveStoreId(ctx, undefined, params.data.id);
    const command = new UpdateProductCommand(requireAuthenticatedPrincipal(ctx), storeId, params.data.id, body.data);
    return respondWithProduct(200, await this.commands.execute<UpdateProductCommand, ProductWithVariants>(command));
  };

  public readonly remove = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = SellerProductParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const storeId = await this.resolveStoreId(ctx, undefined, params.data.id);
    await this.commands.execute<DeleteProductCommand, void>(new DeleteProductCommand(requireAuthenticatedPrincipal(ctx), storeId, params.data.id));
    return empty(204);
  };

  public readonly publish = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = SellerProductParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const storeId = await this.resolveStoreId(ctx, undefined, params.data.id);
    const command = new PublishProductCommand(requireAuthenticatedPrincipal(ctx), storeId, params.data.id);
    return respondWithProduct(200, await this.commands.execute<PublishProductCommand, ProductWithVariants>(command));
  };

  public readonly unpublish = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = SellerProductParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const storeId = await this.resolveStoreId(ctx, undefined, params.data.id);
    const command = new UnpublishProductCommand(requireAuthenticatedPrincipal(ctx), storeId, params.data.id);
    return respondWithProduct(200, await this.commands.execute<UnpublishProductCommand, ProductWithVariants>(command));
  };

  public readonly addVariant = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = SellerProductParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = VariantBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const storeId = await this.resolveStoreId(ctx, undefined, params.data.id);
    const command = new AddProductVariantCommand(requireAuthenticatedPrincipal(ctx), storeId, params.data.id, body.data);
    const added = await this.commands.execute<AddProductVariantCommand, VariantOfProduct>(command);
    return json(201, convertVariantToDto(added.variant, added.product, keepNativeCurrency));
  };

  public readonly updateVariant = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = SellerVariantParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = UpdateVariantBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const storeId = await this.resolveStoreId(ctx, undefined, params.data.id);
    const command = new UpdateProductVariantCommand(requireAuthenticatedPrincipal(ctx), storeId, params.data.id, params.data.variantId, body.data);
    const updated = await this.commands.execute<UpdateProductVariantCommand, VariantOfProduct>(command);
    return json(200, convertVariantToDto(updated.variant, updated.product, keepNativeCurrency));
  };

  public readonly adjustInventory = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = SellerVariantParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = AdjustInventoryBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const storeId = await this.resolveStoreId(ctx, undefined, params.data.id);
    const command = new AdjustInventoryCommand(requireAuthenticatedPrincipal(ctx), storeId, params.data.id, params.data.variantId, body.data.delta);
    const adjusted = await this.commands.execute<AdjustInventoryCommand, VariantOfProduct>(command);
    return json(200, { ...convertVariantToDto(adjusted.variant, adjusted.product, keepNativeCurrency), stockLabel: describeStockLevel(adjusted.variant.stock) });
  };

  private resolveStoreId(ctx: HttpRouterContext, requestedStoreId: string | undefined, productId: string | undefined): Promise<string> {
    return this.queries.execute<ResolveSellerStoreQuery, string>(new ResolveSellerStoreQuery(requireAuthenticatedPrincipal(ctx), requestedStoreId, productId));
  }
}
