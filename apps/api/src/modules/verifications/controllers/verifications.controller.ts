import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import { NotFoundError } from "@zudojs/errors";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { UNVERIFIED_STORE_BADGE } from "../../../interfaces/verificationBadge.interface.js";
import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest, mapPageItems } from "../../../utils/pagination.util.js";
import { ApplyForVerificationCommand } from "../commands/applyForVerification/applyForVerification.command.js";
import { ReviewVerificationCommand } from "../commands/reviewVerification/reviewVerification.command.js";
import { convertVerificationToDto, convertVerificationToPrivateDto } from "../dtos/verifications.dto.js";
import type { VerificationRecord } from "../models/verifications.model.js";
import { GetMyVerificationQuery } from "../queries/getMyVerification/getMyVerification.query.js";
import { GetVerificationQuery } from "../queries/getVerification/getVerification.query.js";
import { ListVerificationsQuery } from "../queries/listVerifications/listVerifications.query.js";
import {
  ApplyForVerificationBodySchema,
  ListVerificationsQuerySchema,
  MyVerificationQuerySchema,
  ProfileParamsSchema,
  ReviewReasonBodySchema,
  SellerVerificationBodySchema,
  StoreScopeQuerySchema,
} from "../validators/verifications.validator.js";

type ReviewDecision = "approve" | "reject" | "suspend" | "revoke";

export class VerificationsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly apply = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = ApplyForVerificationBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new ApplyForVerificationCommand(requireAuthenticatedPrincipal(ctx), body.data);
    return json(201, convertVerificationToPrivateDto(await this.commands.execute<ApplyForVerificationCommand, VerificationRecord>(command)));
  };

  public readonly getMine = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = MyVerificationQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const profileType = query.data.profileType ?? (query.data.storeId === undefined ? "PERSONAL" : "STORE");
    const record = await this.queries.execute<GetMyVerificationQuery, VerificationRecord>(new GetMyVerificationQuery(requireAuthenticatedPrincipal(ctx), profileType, query.data.storeId));
    return json(200, convertVerificationToPrivateDto(record));
  };

  public readonly getPublic = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ProfileParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    return json(200, convertVerificationToDto(await this.queries.execute<GetVerificationQuery, VerificationRecord>(new GetVerificationQuery(params.data.profileId))));
  };

  public readonly list = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListVerificationsQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { status, type, ...page } = query.data;
    const result = await this.queries.execute<ListVerificationsQuery, Page<VerificationRecord>>(new ListVerificationsQuery({ status, type }, buildPageRequest(page)));
    return json(200, mapPageItems(result, convertVerificationToPrivateDto));
  };

  public readonly approve = (ctx: HttpRouterContext) => this.review(ctx, "approve");
  public readonly reject = (ctx: HttpRouterContext) => this.review(ctx, "reject");
  public readonly suspend = (ctx: HttpRouterContext) => this.review(ctx, "suspend");
  public readonly revoke = (ctx: HttpRouterContext) => this.review(ctx, "revoke");

  public readonly getSellerVerification = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = StoreScopeQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    try {
      const record = await this.queries.execute<GetMyVerificationQuery, VerificationRecord>(new GetMyVerificationQuery(requireAuthenticatedPrincipal(ctx), "STORE", query.data.storeId));
      return json(200, convertVerificationToPrivateDto(record));
    } catch (error) {
      if (!(error instanceof NotFoundError) || error.message !== "Verification was not found.") throw error;
      return json(200, { ...UNVERIFIED_STORE_BADGE, verification: UNVERIFIED_STORE_BADGE, details: null });
    }
  };

  public readonly submitSellerVerification = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = StoreScopeQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const body = SellerVerificationBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const principal = requireAuthenticatedPrincipal(ctx);
    const command = new ApplyForVerificationCommand(principal, { profileType: "STORE", storeId: query.data.storeId, details: body.data.details });
    return json(201, convertVerificationToPrivateDto(await this.commands.execute<ApplyForVerificationCommand, VerificationRecord>(command)));
  };

  private async review(ctx: HttpRouterContext, decision: ReviewDecision): Promise<HttpResponseContext> {
    const params = ProfileParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = ReviewReasonBodySchema.safeParse(readJsonBody(ctx) ?? {});
    if (!body.success) return validationFailed(body.issues);
    const command = new ReviewVerificationCommand(requireAuthenticatedPrincipal(ctx), params.data.profileId, decision, body.data.reason);
    return json(200, convertVerificationToPrivateDto(await this.commands.execute<ReviewVerificationCommand, VerificationRecord>(command)));
  }
}
