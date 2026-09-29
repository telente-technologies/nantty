import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { BeginAdminTotpEnrollmentHandler } from "./commands/beginAdminTotpEnrollment/beginAdminTotpEnrollment.handler.js";
import { ChangeStaffAccountStatusHandler } from "./commands/changeStaffAccountStatus/changeStaffAccountStatus.handler.js";
import { CompleteAdminLoginHandler } from "./commands/completeAdminLogin/completeAdminLogin.handler.js";
import { CreateStaffAccountHandler } from "./commands/createStaffAccount/createStaffAccount.handler.js";
import { RegenerateAdminRecoveryCodesHandler } from "./commands/regenerateAdminRecoveryCodes/regenerateAdminRecoveryCodes.handler.js";
import { RemoveWebAuthnCredentialHandler } from "./commands/removeWebAuthnCredential/removeWebAuthnCredential.handler.js";
import { ResetStaffMfaHandler } from "./commands/resetStaffMfa/resetStaffMfa.handler.js";
import { StartAdminLoginHandler } from "./commands/startAdminLogin/startAdminLogin.handler.js";
import { StepUpAdminSessionHandler } from "./commands/stepUpAdminSession/stepUpAdminSession.handler.js";
import { UpdateStaffAccountHandler } from "./commands/updateStaffAccount/updateStaffAccount.handler.js";
import { GetAdminMeHandler } from "./queries/getAdminMe/getAdminMe.handler.js";
import { GetStaffAccountHandler } from "./queries/getStaffAccount/getStaffAccount.handler.js";
import { ListStaffAccountsHandler } from "./queries/listStaffAccounts/listStaffAccounts.handler.js";
import { ListWebAuthnCredentialsHandler } from "./queries/listWebAuthnCredentials/listWebAuthnCredentials.handler.js";
import type { AdminModuleServices } from "./services/adminModule.service.js";

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

export function registerAdminCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, services: AdminModuleServices): void {
  registerCommandHandlers(commands, [
    new StartAdminLoginHandler(services),
    new BeginAdminTotpEnrollmentHandler(services),
    new CompleteAdminLoginHandler(services),
    new StepUpAdminSessionHandler(services),
    new RegenerateAdminRecoveryCodesHandler(services),
    new CreateStaffAccountHandler(services),
    new UpdateStaffAccountHandler(services),
    new ChangeStaffAccountStatusHandler(services),
    new ResetStaffMfaHandler(services),
    new RemoveWebAuthnCredentialHandler(services),
  ]);
  registerQueryHandlers(queries, [
    new GetAdminMeHandler(services),
    new ListStaffAccountsHandler(services),
    new GetStaffAccountHandler(services),
    new ListWebAuthnCredentialsHandler(services),
  ]);
}
