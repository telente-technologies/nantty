import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import type { CurrencyConverter, MoneyConversion } from "../../../interfaces/currencyConverter.interface.js";
import type { InventoryLine } from "../../../interfaces/productCatalog.interface.js";
import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest, mapPageItems } from "../../../utils/pagination.util.js";
import { AddProductVariantCommand } from "../commands/addProductVariant/addProductVariant.command.js";
import { AdjustInventoryCommand } from "../commands/adjustInventory/adjustInventory.command.js";
import { CreateProductCommand } from "../commands/createProduct/createProduct.command.js";
import { DeleteProductCommand } from "../commands/deleteProduct/deleteProduct.command.js";
import { PublishProductCommand } from "../commands/publishProduct/publishProduct.command.js";
import { UnpublishProductCommand } from "../commands/unpublishProduct/unpublishProduct.command.js";
import { UpdateProductCommand } from "../commands/updateProduct/updateProduct.command.js";
import { UpdateProductVariantCommand } from "../commands/updateProductVariant/updateProductVariant.command.js";
import {
  convertProductToCardDto,
  convertProductToDetailDto,
  convertVariantToDto,
  describeStockLevel,
  type MartHomeDto,
  type ProductDetailDto,
  type PublicProductDetailDto,
} from "../dtos/products.dto.js";
import { keepNativeCurrency } from "../dtos/price.dto.js";
import type { ProductRecord, ProductWithVariants, VariantOfProduct } from "../models/products.model.js";
import { GetMartHomeQuery } from "../queries/getMartHome/getMartHome.query.js";
import { GetProductQuery } from "../queries/getProduct/getProduct.query.js";
import { ListProductsQuery } from "../queries/listProducts/listProducts.query.js";
import { ListStoreInventoryQuery } from "../queries/listStoreInventory/listStoreInventory.query.js";
import { ListStoreProductsQuery } from "../queries/listStoreProducts/listStoreProducts.query.js";
import {
  AdjustInventoryBodySchema,
  CreateProductBodySchema,
  ListProductsQuerySchema,
  ProductParamsSchema,
  StorePageQuerySchema,
  StoreParamsSchema,
  StoreProductParamsSchema,
  StoreVariantParamsSchema,
  UpdateProductBodySchema,
  UpdateVariantBodySchema,
  VariantBodySchema,
} from "../validators/products.validator.js";

function respondWithProduct(status: number, result: ProductWithVariants): HttpResponseContext {
  return json(status, convertProductToDetailDto(result.product, result.variants, keepNativeCurrency));
}

export class ProductsController {
  public constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    private readonly currencyConverter: CurrencyConverter,
  ) {}

  public readonly list = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListProductsQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const displayCurrency = findViewerLocale(ctx).currency;
    const listQuery = new ListProductsQuery(query.data, buildPageRequest(query.data), displayCurrency);
    const page = await this.queries.execute<ListProductsQuery, Page<ProductRecord>>(listQuery);
    const convert: MoneyConversion = await this.currencyConverter.prepareConversionInto(displayCurrency);
    return json(200, { ...mapPageItems(page, (product) => convertProductToCardDto(product, convert)), currency: displayCurrency });
  };

  public readonly get = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ProductParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    return json(200, await this.queries.execute<GetProductQuery, PublicProductDetailDto>(new GetProductQuery(params.data.id, findViewerLocale(ctx).currency)));
  };

  public readonly martHome = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    return json(200, await this.queries.execute<GetMartHomeQuery, MartHomeDto>(new GetMartHomeQuery(findViewerLocale(ctx).currency)));
  };

  public readonly listForStore = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = StorePageQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const listQuery = new ListStoreProductsQuery(requireAuthenticatedPrincipal(ctx), params.data.storeId, buildPageRequest(query.data));
    return json(200, await this.queries.execute<ListStoreProductsQuery, Page<ProductDetailDto>>(listQuery));
  };

  public readonly inventory = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = new ListStoreInventoryQuery(requireAuthenticatedPrincipal(ctx), params.data.storeId);
    const lines = await this.queries.execute<ListStoreInventoryQuery, readonly InventoryLine[]>(query);
    return json(200, { items: lines.map((line) => ({ ...line, stockLabel: describeStockLevel(line.stock) })) });
  };

  public readonly create = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = CreateProductBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new CreateProductCommand(requireAuthenticatedPrincipal(ctx), params.data.storeId, body.data);
    return respondWithProduct(201, await this.commands.execute<CreateProductCommand, ProductWithVariants>(command));
  };

  public readonly update = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreProductParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = UpdateProductBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new UpdateProductCommand(requireAuthenticatedPrincipal(ctx), params.data.storeId, params.data.productId, body.data);
    return respondWithProduct(200, await this.commands.execute<UpdateProductCommand, ProductWithVariants>(command));
  };

  public readonly remove = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreProductParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new DeleteProductCommand(requireAuthenticatedPrincipal(ctx), params.data.storeId, params.data.productId);
    await this.commands.execute<DeleteProductCommand, void>(command);
    return empty(204);
  };

  public readonly publish = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreProductParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new PublishProductCommand(requireAuthenticatedPrincipal(ctx), params.data.storeId, params.data.productId);
    return respondWithProduct(200, await this.commands.execute<PublishProductCommand, ProductWithVariants>(command));
  };

  public readonly unpublish = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreProductParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new UnpublishProductCommand(requireAuthenticatedPrincipal(ctx), params.data.storeId, params.data.productId);
    return respondWithProduct(200, await this.commands.execute<UnpublishProductCommand, ProductWithVariants>(command));
  };

  public readonly addVariant = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreProductParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = VariantBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new AddProductVariantCommand(requireAuthenticatedPrincipal(ctx), params.data.storeId, params.data.productId, body.data);
    const added = await this.commands.execute<AddProductVariantCommand, VariantOfProduct>(command);
    return json(201, convertVariantToDto(added.variant, added.product, keepNativeCurrency));
  };

  public readonly updateVariant = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreVariantParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = UpdateVariantBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const { storeId, productId, variantId } = params.data;
    const command = new UpdateProductVariantCommand(requireAuthenticatedPrincipal(ctx), storeId, productId, variantId, body.data);
    const updated = await this.commands.execute<UpdateProductVariantCommand, VariantOfProduct>(command);
    return json(200, convertVariantToDto(updated.variant, updated.product, keepNativeCurrency));
  };

  public readonly adjustInventory = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreVariantParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = AdjustInventoryBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const { storeId, productId, variantId } = params.data;
    const command = new AdjustInventoryCommand(requireAuthenticatedPrincipal(ctx), storeId, productId, variantId, body.data.delta);
    const adjusted = await this.commands.execute<AdjustInventoryCommand, VariantOfProduct>(command);
    return json(200, { ...convertVariantToDto(adjusted.variant, adjusted.product, keepNativeCurrency), stockLabel: describeStockLevel(adjusted.variant.stock) });
  };
}
