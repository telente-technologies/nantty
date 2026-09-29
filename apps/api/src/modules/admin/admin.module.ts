import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { AcceptAdminInvitationHandler } from "./commands/acceptAdminInvitation/acceptAdminInvitation.handler.js";
import { AddAdminPasskeyHandler } from "./commands/addAdminPasskey/addAdminPasskey.handler.js";
import { BeginAdminTotpEnrollmentHandler } from "./commands/beginAdminTotpEnrollment/beginAdminTotpEnrollment.handler.js";
import { ChangeAdminPermissionsHandler } from "./commands/changeAdminPermissions/changeAdminPermissions.handler.js";
import { ConfirmAdminTotpEnrollmentHandler } from "./commands/confirmAdminTotpEnrollment/confirmAdminTotpEnrollment.handler.js";
import { CreateAdminPasskeyOptionsHandler } from "./commands/createAdminPasskeyOptions/createAdminPasskeyOptions.handler.js";
import { CreateAdminSignInPasskeyOptionsHandler } from "./commands/createAdminSignInPasskeyOptions/createAdminSignInPasskeyOptions.handler.js";
import { CreateAdminStepUpPasskeyOptionsHandler } from "./commands/createAdminStepUpPasskeyOptions/createAdminStepUpPasskeyOptions.handler.js";
import { DisableAdminHandler } from "./commands/disableAdmin/disableAdmin.handler.js";
import { EnableAdminHandler } from "./commands/enableAdmin/enableAdmin.handler.js";
import { ExportAdminAuditLogHandler } from "./commands/exportAdminAuditLog/exportAdminAuditLog.handler.js";
import { GetAdminAccountHandler } from "./queries/getAdminAccount/getAdminAccount.handler.js";
import { GetAdminAuditEntryHandler } from "./queries/getAdminAuditEntry/getAdminAuditEntry.handler.js";
import { GetAdminAuditFacetsHandler } from "./queries/getAdminAuditFacets/getAdminAuditFacets.handler.js";
import { GetAdminHandler } from "./queries/getAdmin/getAdmin.handler.js";
import { GetAdminIdentityHandler } from "./queries/getAdminIdentity/getAdminIdentity.handler.js";
import { InviteAdminHandler } from "./commands/inviteAdmin/inviteAdmin.handler.js";
import { ListAdminAuditLogHandler } from "./queries/listAdminAuditLog/listAdminAuditLog.handler.js";
import { ListAdminSessionsHandler } from "./queries/listAdminSessions/listAdminSessions.handler.js";
import { ListAdminsHandler } from "./queries/listAdmins/listAdmins.handler.js";
import { LogoutAdminHandler } from "./commands/logoutAdmin/logoutAdmin.handler.js";
import { PreviewAdminInvitationHandler } from "./queries/previewAdminInvitation/previewAdminInvitation.handler.js";
import { RefreshAdminSessionHandler } from "./commands/refreshAdminSession/refreshAdminSession.handler.js";
import { RegenerateAdminRecoveryCodesHandler } from "./commands/regenerateAdminRecoveryCodes/regenerateAdminRecoveryCodes.handler.js";
import { RemoveAdminPasskeyHandler } from "./commands/removeAdminPasskey/removeAdminPasskey.handler.js";
import { ResetAdminMfaHandler } from "./commands/resetAdminMfa/resetAdminMfa.handler.js";
import { RevokeAdminSessionHandler } from "./commands/revokeAdminSession/revokeAdminSession.handler.js";
import { StartAdminLoginHandler } from "./commands/startAdminLogin/startAdminLogin.handler.js";
import { StepUpAdminSessionHandler } from "./commands/stepUpAdminSession/stepUpAdminSession.handler.js";
import { VerifyAdminSecondFactorHandler } from "./commands/verifyAdminSecondFactor/verifyAdminSecondFactor.handler.js";
import type { AdminServices } from "./services/adminServices.service.js";

export class AdminModule extends BaseModule {
  public readonly id = "admin";
  public readonly name = "admin";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("admin module initialized");
  }
}

export function registerAdminCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, services: AdminServices): void {
  registerCommandHandlers(commands, [
    new AcceptAdminInvitationHandler(services),
    new AddAdminPasskeyHandler(services),
    new BeginAdminTotpEnrollmentHandler(services),
    new ChangeAdminPermissionsHandler(services),
    new ConfirmAdminTotpEnrollmentHandler(services),
    new CreateAdminPasskeyOptionsHandler(services),
    new CreateAdminSignInPasskeyOptionsHandler(services),
    new CreateAdminStepUpPasskeyOptionsHandler(services),
    new DisableAdminHandler(services),
    new EnableAdminHandler(services),
    new ExportAdminAuditLogHandler(services),
    new InviteAdminHandler(services),
    new LogoutAdminHandler(services),
    new RefreshAdminSessionHandler(services),
    new RegenerateAdminRecoveryCodesHandler(services),
    new RemoveAdminPasskeyHandler(services),
    new ResetAdminMfaHandler(services),
    new RevokeAdminSessionHandler(services),
    new StartAdminLoginHandler(services),
    new StepUpAdminSessionHandler(services),
    new VerifyAdminSecondFactorHandler(services),
  ]);
  registerQueryHandlers(queries, [
    new GetAdminHandler(services),
    new GetAdminAccountHandler(services),
    new GetAdminAuditEntryHandler(services),
    new GetAdminAuditFacetsHandler(services),
    new GetAdminIdentityHandler(services),
    new ListAdminAuditLogHandler(services),
    new ListAdminSessionsHandler(services),
    new ListAdminsHandler(services),
    new PreviewAdminInvitationHandler(services),
  ]);
}
