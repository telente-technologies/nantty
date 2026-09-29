import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { findAuthenticatedPrincipal, requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { convertUserToCurrentUserDto } from "../../users/dtos/users.dto.js";
import { LoginCommand } from "../commands/login/login.command.js";
import { LogoutCommand } from "../commands/logout/logout.command.js";
import { RefreshTokenCommand } from "../commands/refreshToken/refreshToken.command.js";
import { RegisterCommand } from "../commands/register/register.command.js";
import { ChangePasswordCommand } from "../commands/changePassword/changePassword.command.js";
import { ResetPasswordCommand } from "../commands/resetPassword/resetPassword.command.js";
import { RevokeSessionCommand } from "../commands/revokeSession/revokeSession.command.js";
import { SendOtpCommand } from "../commands/sendOtp/sendOtp.command.js";
import { SocialSignInCommand } from "../commands/socialSignIn/socialSignIn.command.js";
import { VerifyOtpCommand } from "../commands/verifyOtp/verifyOtp.command.js";
import type { VerifyOtpResult } from "../commands/verifyOtp/verifyOtp.handler.js";
import { convertIssuedTokensToDto, convertSessionToDto } from "../dtos/auth.dto.js";
import type { AuthenticationResult, ClientDetails, IssuedTokens, SessionRecord, SocialProvider } from "../models/auth.model.js";
import { CheckUsernameAvailabilityQuery } from "../queries/checkUsernameAvailability/checkUsernameAvailability.query.js";
import { GetSessionQuery } from "../queries/getSession/getSession.query.js";
import { ListSessionsQuery } from "../queries/listSessions/listSessions.query.js";
import {
  ChangePasswordBodySchema,
  LoginBodySchema,
  LogoutBodySchema,
  RefreshTokenBodySchema,
  RegisterBodySchema,
  ResetPasswordBodySchema,
  SendOneTimeCodeBodySchema,
  SessionParamsSchema,
  SocialSignInBodySchema,
  UsernameAvailabilityQuerySchema,
  VerifyOneTimeCodeBodySchema,
} from "../validators/auth.validator.js";

function readClientDetails(ctx: HttpRouterContext): ClientDetails {
  return {
    userAgent: ctx.request.getHeader("user-agent")?.slice(0, 255) ?? null,
    ip: ctx.request.remoteAddress ?? null,
  };
}

function convertAuthenticationResultToSession(result: AuthenticationResult) {
  return { ...convertIssuedTokensToDto(result.tokens), user: convertUserToCurrentUserDto(result.user), isNewUser: result.isNewUser };
}

function convertAuthenticationResultToResponse(status: number, result: AuthenticationResult): HttpResponseContext {
  return json(status, convertAuthenticationResultToSession(result));
}

export class AuthController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly register = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = RegisterBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const result = await this.commands.execute<RegisterCommand, AuthenticationResult>(new RegisterCommand(body.data, readClientDetails(ctx)));
    return convertAuthenticationResultToResponse(201, result);
  };

  public readonly login = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = LoginBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new LoginCommand(body.data.identifier, body.data.password, readClientDetails(ctx));
    return convertAuthenticationResultToResponse(200, await this.commands.execute<LoginCommand, AuthenticationResult>(command));
  };

  public readonly signInWithGoogle = (ctx: HttpRouterContext) => this.signInWithProvider(ctx, "google");

  public readonly signInWithApple = (ctx: HttpRouterContext) => this.signInWithProvider(ctx, "apple");

  public readonly sendOneTimeCode = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = SendOneTimeCodeBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    return json(200, await this.commands.execute<SendOtpCommand, { expiresIn: number }>(new SendOtpCommand(body.data)));
  };

  public readonly verifyOneTimeCode = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = VerifyOneTimeCodeBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const result = await this.commands.execute<VerifyOtpCommand, VerifyOtpResult>(new VerifyOtpCommand(body.data, readClientDetails(ctx)));
    return json(200, { otpToken: result.otpToken, ...(result.session === undefined ? {} : convertAuthenticationResultToSession(result.session)) });
  };

  public readonly changePassword = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = ChangePasswordBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    await this.commands.execute<ChangePasswordCommand, void>(new ChangePasswordCommand(requireAuthenticatedPrincipal(ctx), body.data));
    return empty(204);
  };

  public readonly resetPassword = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = ResetPasswordBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    await this.commands.execute<ResetPasswordCommand, void>(new ResetPasswordCommand(body.data));
    return empty(204);
  };

  public readonly refresh = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = RefreshTokenBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const tokens = await this.commands.execute<RefreshTokenCommand, IssuedTokens>(new RefreshTokenCommand(body.data.refreshToken));
    return json(200, convertIssuedTokensToDto(tokens));
  };

  public readonly logout = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = LogoutBodySchema.safeParse(readJsonBody(ctx) ?? {});
    if (!body.success) return validationFailed(body.issues);
    await this.commands.execute<LogoutCommand, void>(new LogoutCommand(findAuthenticatedPrincipal(ctx), body.data.refreshToken));
    return empty(204);
  };

  public readonly listSessions = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const principal = requireAuthenticatedPrincipal(ctx);
    const sessions = await this.queries.execute<ListSessionsQuery, readonly SessionRecord[]>(new ListSessionsQuery(principal));
    return json(200, sessions.map((session) => convertSessionToDto(session, principal.sessionId)));
  };

  public readonly getSession = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = SessionParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const principal = requireAuthenticatedPrincipal(ctx);
    const session = await this.queries.execute<GetSessionQuery, SessionRecord>(new GetSessionQuery(principal, params.data.id));
    return json(200, convertSessionToDto(session, principal.sessionId));
  };

  public readonly revokeSession = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = SessionParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<RevokeSessionCommand, void>(new RevokeSessionCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return empty(204);
  };

  public readonly checkUsernameAvailability = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = UsernameAvailabilityQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const available = await this.queries.execute<CheckUsernameAvailabilityQuery, boolean>(new CheckUsernameAvailabilityQuery(query.data.username));
    return json(200, { available });
  };

  private async signInWithProvider(ctx: HttpRouterContext, provider: SocialProvider): Promise<HttpResponseContext> {
    const body = SocialSignInBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new SocialSignInCommand(provider, body.data, readClientDetails(ctx));
    const result = await this.commands.execute<SocialSignInCommand, AuthenticationResult>(command);
    return convertAuthenticationResultToResponse(result.isNewUser ? 201 : 200, result);
  }
}
