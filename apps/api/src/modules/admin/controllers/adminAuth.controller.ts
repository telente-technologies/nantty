import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { AcceptAdminInvitationCommand } from "../commands/acceptAdminInvitation/acceptAdminInvitation.command.js";
import { BeginAdminTotpEnrollmentCommand } from "../commands/beginAdminTotpEnrollment/beginAdminTotpEnrollment.command.js";
import { ConfirmAdminTotpEnrollmentCommand } from "../commands/confirmAdminTotpEnrollment/confirmAdminTotpEnrollment.command.js";
import { CreateAdminSignInPasskeyOptionsCommand } from "../commands/createAdminSignInPasskeyOptions/createAdminSignInPasskeyOptions.command.js";
import { CreateAdminStepUpPasskeyOptionsCommand } from "../commands/createAdminStepUpPasskeyOptions/createAdminStepUpPasskeyOptions.command.js";
import { LogoutAdminCommand } from "../commands/logoutAdmin/logoutAdmin.command.js";
import { RefreshAdminSessionCommand } from "../commands/refreshAdminSession/refreshAdminSession.command.js";
import { StartAdminLoginCommand } from "../commands/startAdminLogin/startAdminLogin.command.js";
import { StepUpAdminSessionCommand } from "../commands/stepUpAdminSession/stepUpAdminSession.command.js";
import { VerifyAdminSecondFactorCommand } from "../commands/verifyAdminSecondFactor/verifyAdminSecondFactor.command.js";
import { GetAdminIdentityQuery } from "../queries/getAdminIdentity/getAdminIdentity.query.js";
import { PreviewAdminInvitationQuery } from "../queries/previewAdminInvitation/previewAdminInvitation.query.js";
import type { AdminSignedIn } from "../services/adminSignIn.service.js";
import type { IssuedAdminTokens, StaffClient } from "../services/adminTokens.service.js";
import { requireStaffRequestState } from "../services/staffRequestGuard.service.js";
import {
  AcceptInvitationBodySchema,
  AdminLoginBodySchema,
  AdminMfaTokenBodySchema,
  AdminMfaVerifyBodySchema,
  AdminRefreshBodySchema,
  AdminStepUpBodySchema,
  AdminTotpConfirmBodySchema,
  InvitationParamsSchema,
} from "../validators/admin.validator.js";

export function readStaffClient(ctx: HttpRouterContext): StaffClient {
  return { ipAddress: ctx.request.remoteAddress ?? null, userAgent: ctx.request.getHeader("user-agent")?.slice(0, 255) ?? null };
}

function convertTokens(tokens: IssuedAdminTokens) {
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn, tokenType: tokens.tokenType };
}

function convertSignedIn(result: AdminSignedIn) {
  return { ...convertTokens(result.tokens), admin: result.admin, ...(result.recoveryCodes === undefined ? {} : { recoveryCodes: result.recoveryCodes }) };
}

export class AdminAuthController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly login = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = AdminLoginBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    return json(200, await this.commands.execute(new StartAdminLoginCommand(body.data.email, body.data.password, readStaffClient(ctx))));
  };

  public readonly enrollTotp = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = AdminMfaTokenBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    return json(200, await this.commands.execute(new BeginAdminTotpEnrollmentCommand(body.data.mfaToken)));
  };

  public readonly confirmTotp = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = AdminTotpConfirmBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const result = await this.commands.execute<ConfirmAdminTotpEnrollmentCommand, AdminSignedIn>(new ConfirmAdminTotpEnrollmentCommand(body.data.mfaToken, body.data.code, readStaffClient(ctx)));
    return json(200, convertSignedIn(result));
  };

  public readonly verifyMfa = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = AdminMfaVerifyBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const proof = { method: body.data.method, code: body.data.code, credential: body.data.credential };
    const result = await this.commands.execute<VerifyAdminSecondFactorCommand, AdminSignedIn>(new VerifyAdminSecondFactorCommand(body.data.mfaToken, proof, readStaffClient(ctx)));
    return json(200, convertSignedIn(result));
  };

  public readonly signInPasskeyOptions = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = AdminMfaTokenBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    return json(200, await this.commands.execute(new CreateAdminSignInPasskeyOptionsCommand(body.data.mfaToken)));
  };

  public readonly refresh = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = AdminRefreshBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    return json(200, convertTokens(await this.commands.execute<RefreshAdminSessionCommand, IssuedAdminTokens>(new RefreshAdminSessionCommand(body.data.refreshToken))));
  };

  public readonly logout = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = AdminRefreshBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    await this.commands.execute(new LogoutAdminCommand(body.data.refreshToken));
    return empty(204);
  };

  public readonly me = async (ctx: HttpRouterContext): Promise<HttpResponseContext> =>
    json(200, await this.queries.execute(new GetAdminIdentityQuery(requireStaffRequestState(ctx))));

  public readonly stepUp = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = AdminStepUpBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const proof = { method: body.data.method, code: body.data.code, credential: body.data.credential };
    return json(200, await this.commands.execute(new StepUpAdminSessionCommand(requireStaffRequestState(ctx), proof)));
  };

  public readonly stepUpPasskeyOptions = async (ctx: HttpRouterContext): Promise<HttpResponseContext> =>
    json(200, await this.commands.execute(new CreateAdminStepUpPasskeyOptionsCommand(requireStaffRequestState(ctx))));

  public readonly previewInvitation = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = InvitationParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    return json(200, await this.queries.execute(new PreviewAdminInvitationQuery(params.data.token)));
  };

  public readonly acceptInvitation = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = InvitationParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = AcceptInvitationBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    return json(200, await this.commands.execute(new AcceptAdminInvitationCommand(params.data.token, body.data.password)));
  };
}
