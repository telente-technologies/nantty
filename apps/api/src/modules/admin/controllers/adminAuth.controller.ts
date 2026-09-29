import type { CommandBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { convertIssuedTokensToDto } from "../../auth/dtos/auth.dto.js";
import { BeginAdminTotpEnrollmentCommand } from "../commands/beginAdminTotpEnrollment/beginAdminTotpEnrollment.command.js";
import { CompleteAdminLoginCommand } from "../commands/completeAdminLogin/completeAdminLogin.command.js";
import { StartAdminLoginCommand } from "../commands/startAdminLogin/startAdminLogin.command.js";
import { StepUpAdminSessionCommand } from "../commands/stepUpAdminSession/stepUpAdminSession.command.js";
import type { AdminLoginChallenge, CompletedAdminLogin } from "../services/adminSession.service.js";
import type { TotpEnrollment } from "../services/staffMfa.service.js";
import { AdminChallengeBodySchema, AdminCompleteLoginBodySchema, AdminLoginBodySchema, AdminStepUpBodySchema } from "../validators/admin.validator.js";

function readSecondFactorProof(body: { readonly code?: string | undefined; readonly recoveryCode?: string | undefined }) {
  return { ...(body.code === undefined ? {} : { code: body.code }), ...(body.recoveryCode === undefined ? {} : { recoveryCode: body.recoveryCode }) };
}

export class AdminAuthController {
  public constructor(private readonly commands: CommandBus) {}

  public readonly startLogin = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = AdminLoginBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new StartAdminLoginCommand(body.data.identifier, body.data.password);
    return json(200, await this.commands.execute<StartAdminLoginCommand, AdminLoginChallenge>(command));
  };

  public readonly beginTotpEnrollment = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = AdminChallengeBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new BeginAdminTotpEnrollmentCommand(body.data.challengeToken);
    return json(200, await this.commands.execute<BeginAdminTotpEnrollmentCommand, TotpEnrollment>(command));
  };

  public readonly completeLogin = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = AdminCompleteLoginBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const client = { userAgent: ctx.request.getHeader("user-agent")?.slice(0, 255) ?? null, ip: ctx.request.remoteAddress ?? null };
    const command = new CompleteAdminLoginCommand(body.data.challengeToken, readSecondFactorProof(body.data), client);
    const result = await this.commands.execute<CompleteAdminLoginCommand, CompletedAdminLogin>(command);
    return json(200, { ...convertIssuedTokensToDto(result.tokens), recoveryCodes: result.recoveryCodes });
  };

  public readonly stepUp = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = AdminStepUpBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new StepUpAdminSessionCommand(requireAuthenticatedPrincipal(ctx), readSecondFactorProof(body.data));
    return json(200, await this.commands.execute<StepUpAdminSessionCommand, { stepUpValidUntil: string }>(command));
  };
}
