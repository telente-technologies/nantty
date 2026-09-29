import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { ADMIN_PERMISSIONS } from "../../../constants/permissions.constant.js";
import { PLATFORM_ROLES, listDefaultPermissionsForPlatformRole } from "../../../constants/platformRoles.constant.js";
import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { ChangeStaffAccountStatusCommand } from "../commands/changeStaffAccountStatus/changeStaffAccountStatus.command.js";
import { CreateStaffAccountCommand } from "../commands/createStaffAccount/createStaffAccount.command.js";
import { RegenerateAdminRecoveryCodesCommand } from "../commands/regenerateAdminRecoveryCodes/regenerateAdminRecoveryCodes.command.js";
import { RemoveWebAuthnCredentialCommand } from "../commands/removeWebAuthnCredential/removeWebAuthnCredential.command.js";
import { ResetStaffMfaCommand } from "../commands/resetStaffMfa/resetStaffMfa.command.js";
import { UpdateStaffAccountCommand } from "../commands/updateStaffAccount/updateStaffAccount.command.js";
import type { AdminMeDto, StaffAccountDto } from "../dtos/admin.dto.js";
import { GetAdminMeQuery } from "../queries/getAdminMe/getAdminMe.query.js";
import { GetStaffAccountQuery } from "../queries/getStaffAccount/getStaffAccount.query.js";
import { ListStaffAccountsQuery } from "../queries/listStaffAccounts/listStaffAccounts.query.js";
import { ListWebAuthnCredentialsQuery } from "../queries/listWebAuthnCredentials/listWebAuthnCredentials.query.js";
import type { WebAuthnVerifier } from "../services/webAuthn.service.js";
import { CreateStaffAccountBodySchema, StaffAccountParamsSchema, UpdateStaffAccountBodySchema, WebAuthnCredentialParamsSchema } from "../validators/admin.validator.js";

export class AdminStaffController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus, private readonly webAuthn: WebAuthnVerifier) {}

  public readonly getMe = async (ctx: HttpRouterContext): Promise<HttpResponseContext> =>
    json(200, await this.queries.execute<GetAdminMeQuery, AdminMeDto>(new GetAdminMeQuery(requireAuthenticatedPrincipal(ctx))));

  public readonly listPermissions = async (): Promise<HttpResponseContext> =>
    json(200, {
      permissions: [...ADMIN_PERMISSIONS],
      roles: PLATFORM_ROLES.map((role) => ({ role, defaultPermissions: listDefaultPermissionsForPlatformRole(role) })),
    });

  public readonly listAccounts = async (): Promise<HttpResponseContext> =>
    json(200, await this.queries.execute<ListStaffAccountsQuery, readonly StaffAccountDto[]>(new ListStaffAccountsQuery()));

  public readonly getAccount = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StaffAccountParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    return json(200, await this.queries.execute<GetStaffAccountQuery, StaffAccountDto>(new GetStaffAccountQuery(params.data.userId)));
  };

  public readonly createAccount = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = CreateStaffAccountBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new CreateStaffAccountCommand(requireAuthenticatedPrincipal(ctx), body.data);
    return json(201, await this.commands.execute<CreateStaffAccountCommand, StaffAccountDto>(command));
  };

  public readonly updateAccount = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StaffAccountParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = UpdateStaffAccountBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new UpdateStaffAccountCommand(requireAuthenticatedPrincipal(ctx), params.data.userId, body.data);
    return json(200, await this.commands.execute<UpdateStaffAccountCommand, StaffAccountDto>(command));
  };

  public readonly disableAccount = (ctx: HttpRouterContext) => this.changeStatus(ctx, "disabled");

  public readonly enableAccount = (ctx: HttpRouterContext) => this.changeStatus(ctx, "active");

  public readonly resetMfa = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StaffAccountParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new ResetStaffMfaCommand(requireAuthenticatedPrincipal(ctx), params.data.userId);
    return json(200, await this.commands.execute<ResetStaffMfaCommand, StaffAccountDto>(command));
  };

  public readonly regenerateRecoveryCodes = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const command = new RegenerateAdminRecoveryCodesCommand(requireAuthenticatedPrincipal(ctx));
    return json(200, await this.commands.execute<RegenerateAdminRecoveryCodesCommand, { recoveryCodes: readonly string[] }>(command));
  };

  public readonly listWebAuthnCredentials = async (ctx: HttpRouterContext): Promise<HttpResponseContext> =>
    json(200, await this.queries.execute<ListWebAuthnCredentialsQuery, unknown>(new ListWebAuthnCredentialsQuery(requireAuthenticatedPrincipal(ctx))));

  public readonly createWebAuthnRegistrationOptions = async (ctx: HttpRouterContext): Promise<HttpResponseContext> =>
    json(200, await this.webAuthn.createRegistrationOptions(requireAuthenticatedPrincipal(ctx).userId, []));

  public readonly removeWebAuthnCredential = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = WebAuthnCredentialParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<RemoveWebAuthnCredentialCommand, void>(new RemoveWebAuthnCredentialCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return empty(204);
  };

  private async changeStatus(ctx: HttpRouterContext, status: "active" | "disabled"): Promise<HttpResponseContext> {
    const params = StaffAccountParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new ChangeStaffAccountStatusCommand(requireAuthenticatedPrincipal(ctx), params.data.userId, status);
    return json(200, await this.commands.execute<ChangeStaffAccountStatusCommand, StaffAccountDto>(command));
  }
}
