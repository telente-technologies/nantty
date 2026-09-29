import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { Money } from "../../../utils/money.util.js";
import { buildPageRequest, mapPageItems } from "../../../utils/pagination.util.js";
import { CreateCashbackPromoCommand } from "../commands/createCashbackPromo/createCashbackPromo.command.js";
import { DeactivateCashbackPromoCommand } from "../commands/deactivateCashbackPromo/deactivateCashbackPromo.command.js";
import { RedeemCheckoutPointsCommand } from "../commands/redeemCheckoutPoints/redeemCheckoutPoints.command.js";
import { RedeemReferralCodeCommand } from "../commands/redeemReferralCode/redeemReferralCode.command.js";
import { ReleaseCheckoutPointsCommand } from "../commands/releaseCheckoutPoints/releaseCheckoutPoints.command.js";
import { convertCashbackPromoToDto, convertLoyaltyRewardToDto, type LoyaltySummaryDto, type ReferralSummaryDto } from "../dtos/loyalty.dto.js";
import type { CashbackPromoRecord, LoyaltyRewardRecord, PointsRedemptionRecord, ReferralRecord } from "../models/loyalty.model.js";
import { GetLoyaltySummaryQuery } from "../queries/getLoyaltySummary/getLoyaltySummary.query.js";
import { GetReferralSummaryQuery } from "../queries/getReferralSummary/getReferralSummary.query.js";
import { ListCashbackPromosQuery } from "../queries/listCashbackPromos/listCashbackPromos.query.js";
import { ListLoyaltyHistoryQuery } from "../queries/listLoyaltyHistory/listLoyaltyHistory.query.js";
import {
  CashbackPromoBodySchema,
  CheckoutIdParamsSchema,
  LoyaltyPageQuerySchema,
  PromoIdParamsSchema,
  RedeemCheckoutPointsBodySchema,
  RedeemReferralBodySchema,
} from "../validators/loyalty.validator.js";

export class LoyaltyController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly summary = async (ctx: HttpRouterContext): Promise<HttpResponseContext> =>
    json(200, await this.queries.execute<GetLoyaltySummaryQuery, LoyaltySummaryDto>(new GetLoyaltySummaryQuery(requireAuthenticatedPrincipal(ctx).userId, findViewerLocale(ctx).currency)));

  public readonly referrals = async (ctx: HttpRouterContext): Promise<HttpResponseContext> =>
    json(200, await this.queries.execute<GetReferralSummaryQuery, ReferralSummaryDto>(new GetReferralSummaryQuery(requireAuthenticatedPrincipal(ctx).userId, findViewerLocale(ctx).currency)));

  public readonly history = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = LoyaltyPageQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const page = await this.queries.execute<ListLoyaltyHistoryQuery, Page<LoyaltyRewardRecord>>(new ListLoyaltyHistoryQuery(requireAuthenticatedPrincipal(ctx).userId, buildPageRequest(query.data)));
    return json(200, mapPageItems(page, convertLoyaltyRewardToDto));
  };

  public readonly redeemReferral = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = RedeemReferralBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const referral = await this.commands.execute<RedeemReferralCodeCommand, ReferralRecord>(new RedeemReferralCodeCommand(requireAuthenticatedPrincipal(ctx).userId, body.data.code));
    return json(201, { id: referral.id, code: referral.code, status: referral.status, createdAt: referral.createdAt.toISOString() });
  };

  public readonly redeemPoints = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = RedeemCheckoutPointsBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new RedeemCheckoutPointsCommand(requireAuthenticatedPrincipal(ctx).userId, body.data.checkoutId, body.data.points);
    const redemption = await this.commands.execute<RedeemCheckoutPointsCommand, PointsRedemptionRecord>(command);
    return json(201, { checkoutId: redemption.checkoutId, points: redemption.points, discount: Money.of(redemption.discount, redemption.currency).toDto(), status: redemption.status });
  };

  public readonly releasePoints = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = CheckoutIdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<ReleaseCheckoutPointsCommand, void>(new ReleaseCheckoutPointsCommand(requireAuthenticatedPrincipal(ctx).userId, params.data.checkoutId));
    return empty(204);
  };

  public readonly listPromos = async (): Promise<HttpResponseContext> =>
    json(200, { data: (await this.queries.execute<ListCashbackPromosQuery, readonly CashbackPromoRecord[]>(new ListCashbackPromosQuery())).map(convertCashbackPromoToDto) });

  public readonly createPromo = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = CashbackPromoBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    if (body.data.storeId === undefined && body.data.categoryId === undefined) return json(400, { message: "Choose a store or a category for the promo.", code: "VALIDATION_FAILED" });
    const promo = await this.commands.execute<CreateCashbackPromoCommand, CashbackPromoRecord>(new CreateCashbackPromoCommand(requireAuthenticatedPrincipal(ctx).userId, body.data));
    return json(201, convertCashbackPromoToDto(promo));
  };

  public readonly deactivatePromo = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PromoIdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<DeactivateCashbackPromoCommand, void>(new DeactivateCashbackPromoCommand(requireAuthenticatedPrincipal(ctx).userId, params.data.id));
    return empty(204);
  };
}
