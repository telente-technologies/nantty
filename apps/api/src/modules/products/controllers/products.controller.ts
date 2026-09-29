import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import type { CurrencyConverter } from "../../../interfaces/currencyConverter.interface.js";
import { findAuthenticatedPrincipal, requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { json, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { ChangeProductEngagementCommand } from "../commands/changeProductEngagement/changeProductEngagement.command.js";
import { convertProductToCardDto, type MartHomeDto, type PublicProductDetailDto, type SponsorableProduct } from "../dtos/products.dto.js";
import { GetMartHomeQuery } from "../queries/getMartHome/getMartHome.query.js";
import { GetProductQuery } from "../queries/getProduct/getProduct.query.js";
import type { ViewerProductEngagement } from "../queries/getViewerProductEngagement/getViewerProductEngagement.handler.js";
import { GetViewerProductEngagementQuery } from "../queries/getViewerProductEngagement/getViewerProductEngagement.query.js";
import { ListProductsQuery } from "../queries/listProducts/listProducts.query.js";
import type { ProductEngagementKind } from "../repositories/productEngagement.repository.js";
import { ListProductsQuerySchema, ProductParamsSchema, StorePageQuerySchema, StoreParamsSchema, type ListProductsQueryInput } from "../validators/products.validator.js";

const FEATURED_PRODUCT_COUNT = 20;

export class ProductsController {
  public constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    private readonly currencyConverter: CurrencyConverter,
  ) {}

  public readonly list = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListProductsQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    return this.respondWithProductPage(ctx, query.data);
  };

  public readonly listFeatured = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    return this.respondWithProductPage(ctx, { sort: "popular", limit: FEATURED_PRODUCT_COUNT });
  };

  public readonly listForPublicStore = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = StorePageQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    return this.respondWithProductPage(ctx, { ...query.data, storeId: params.data.storeId });
  };

  public readonly get = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ProductParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const product = await this.queries.execute<GetProductQuery, PublicProductDetailDto>(new GetProductQuery(params.data.id, findViewerLocale(ctx).currency));
    const engagement = await this.findViewerEngagement(ctx, [product.id, ...product.related.map((item) => item.id)]);
    return json(200, {
      ...product,
      liked: engagement.likedProductIds.has(product.id),
      bookmarked: engagement.bookmarkedProductIds.has(product.id),
      related: product.related.map((item) => ({ ...item, liked: engagement.likedProductIds.has(item.id) })),
    });
  };

  public readonly martHome = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const locale = findViewerLocale(ctx);
    const viewer = { viewerId: findAuthenticatedPrincipal(ctx)?.userId, country: locale.countryCode };
    return json(200, await this.queries.execute<GetMartHomeQuery, MartHomeDto>(new GetMartHomeQuery(locale.currency, viewer)));
  };

  public readonly like = (ctx: HttpRouterContext) => this.changeEngagement(ctx, "like", true);

  public readonly unlike = (ctx: HttpRouterContext) => this.changeEngagement(ctx, "like", false);

  public readonly bookmark = (ctx: HttpRouterContext) => this.changeEngagement(ctx, "bookmark", true);

  public readonly removeBookmark = (ctx: HttpRouterContext) => this.changeEngagement(ctx, "bookmark", false);

  private async changeEngagement(ctx: HttpRouterContext, kind: ProductEngagementKind, engaged: boolean): Promise<HttpResponseContext> {
    const params = ProductParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new ChangeProductEngagementCommand(requireAuthenticatedPrincipal(ctx), params.data.id, kind, engaged);
    await this.commands.execute<ChangeProductEngagementCommand, { engaged: boolean }>(command);
    return json(200, kind === "like" ? { liked: engaged } : { bookmarked: engaged });
  }

  private async respondWithProductPage(ctx: HttpRouterContext, filter: ListProductsQueryInput): Promise<HttpResponseContext> {
    const displayCurrency = findViewerLocale(ctx).currency;
    const viewer = { viewerId: findAuthenticatedPrincipal(ctx)?.userId, country: findViewerLocale(ctx).countryCode };
    const page = await this.queries.execute<ListProductsQuery, Page<SponsorableProduct>>(new ListProductsQuery(filter, buildPageRequest(filter), displayCurrency, viewer));
    const convert = await this.currencyConverter.prepareConversionInto(displayCurrency);
    const engagement = await this.findViewerEngagement(ctx, page.data.map((product) => product.id));
    return json(200, {
      data: page.data.map((product) => ({ ...convertProductToCardDto(product, convert), liked: engagement.likedProductIds.has(product.id) })),
      nextCursor: page.nextCursor,
      currency: displayCurrency,
    });
  }

  private findViewerEngagement(ctx: HttpRouterContext, productIds: readonly string[]): Promise<ViewerProductEngagement> {
    const query = new GetViewerProductEngagementQuery(findAuthenticatedPrincipal(ctx)?.userId, productIds);
    return this.queries.execute<GetViewerProductEngagementQuery, ViewerProductEngagement>(query);
  }
}
