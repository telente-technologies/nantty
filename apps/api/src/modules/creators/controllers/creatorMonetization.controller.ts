import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { IDEMPOTENCY_KEY_HEADER } from "../../../constants/security.constant.js";
import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { ConvertEarnedCoinsCommand } from "../commands/convertEarnedCoins/convertEarnedCoins.command.js";
import { RecordBrandDealCommand } from "../commands/recordBrandDeal/recordBrandDeal.command.js";
import { RemoveBrandDealCommand } from "../commands/removeBrandDeal/removeBrandDeal.command.js";
import { SendPostGiftCommand } from "../commands/sendPostGift/sendPostGift.command.js";
import { SendTipCommand } from "../commands/sendTip/sendTip.command.js";
import type { BrandDealDto, CoinConversionReceiptDto, CreatorRevenueRulesDto, GiftReceiptDto, TipReceiptDto } from "../dtos/creators.dto.js";
import { GetCreatorRevenueRulesQuery } from "../queries/getCreatorRevenueRules/getCreatorRevenueRules.query.js";
import { ListBrandDealsQuery } from "../queries/listBrandDeals/listBrandDeals.query.js";
import { BrandDealBodySchema, ConvertEarnedCoinsBodySchema, IdParamsSchema, PageQuerySchema, SendLiveGiftBodySchema, SendTipBodySchema } from "../validators/creators.validator.js";

function readIdempotencyKey(ctx: HttpRouterContext): string {
  return ctx.request.getHeader(IDEMPOTENCY_KEY_HEADER)?.trim() ?? "";
}

export class CreatorMonetizationController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly sendPostGift = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = IdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = SendLiveGiftBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new SendPostGiftCommand({
      senderId: requireAuthenticatedPrincipal(ctx).userId, postId: params.data.id, giftId: body.data.giftId, quantity: body.data.quantity, idempotencyKey: readIdempotencyKey(ctx),
    });
    return json(201, await this.commands.execute<SendPostGiftCommand, GiftReceiptDto>(command));
  };

  public readonly sendTip = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = SendTipBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new SendTipCommand({ ...body.data, senderId: requireAuthenticatedPrincipal(ctx).userId, idempotencyKey: readIdempotencyKey(ctx) });
    return json(201, await this.commands.execute<SendTipCommand, TipReceiptDto>(command));
  };

  public readonly convertEarnedCoins = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = ConvertEarnedCoinsBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new ConvertEarnedCoinsCommand({
      userId: requireAuthenticatedPrincipal(ctx).userId, coins: body.data.coins, currency: body.data.currency ?? findViewerLocale(ctx).currency, idempotencyKey: readIdempotencyKey(ctx),
    });
    return json(201, await this.commands.execute<ConvertEarnedCoinsCommand, CoinConversionReceiptDto>(command));
  };

  public readonly revenueRules = async (ctx: HttpRouterContext): Promise<HttpResponseContext> =>
    json(200, await this.queries.execute<GetCreatorRevenueRulesQuery, CreatorRevenueRulesDto>(new GetCreatorRevenueRulesQuery(findViewerLocale(ctx).currency)));

  public readonly recordBrandDeal = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = BrandDealBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new RecordBrandDealCommand(requireAuthenticatedPrincipal(ctx).userId, body.data);
    return json(201, await this.commands.execute<RecordBrandDealCommand, BrandDealDto>(command));
  };

  public readonly listBrandDeals = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = PageQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const listQuery = new ListBrandDealsQuery(requireAuthenticatedPrincipal(ctx).userId, buildPageRequest(query.data));
    return json(200, await this.queries.execute<ListBrandDealsQuery, Page<BrandDealDto>>(listQuery));
  };

  public readonly removeBrandDeal = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = IdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<RemoveBrandDealCommand, void>(new RemoveBrandDealCommand(requireAuthenticatedPrincipal(ctx).userId, params.data.id));
    return empty(204);
  };
}
