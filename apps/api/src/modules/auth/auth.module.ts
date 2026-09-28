import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";

import { LoginHandler } from "./commands/login/login.handler.js";
import { LogoutHandler } from "./commands/logout/logout.handler.js";
import { RefreshTokenHandler } from "./commands/refreshToken/refreshToken.handler.js";
import { RegisterHandler } from "./commands/register/register.handler.js";
import { RequestPasswordResetHandler } from "./commands/requestPasswordReset/requestPasswordReset.handler.js";
import { ResetPasswordHandler } from "./commands/resetPassword/resetPassword.handler.js";
import { RevokeSessionHandler } from "./commands/revokeSession/revokeSession.handler.js";
import { SendOtpHandler } from "./commands/sendOtp/sendOtp.handler.js";
import { SocialSignInHandler } from "./commands/socialSignIn/socialSignIn.handler.js";
import { VerifyOtpHandler } from "./commands/verifyOtp/verifyOtp.handler.js";
import { CheckUsernameAvailabilityHandler } from "./queries/checkUsernameAvailability/checkUsernameAvailability.handler.js";
import { GetSessionHandler } from "./queries/getSession/getSession.handler.js";
import { ListSessionsHandler } from "./queries/listSessions/listSessions.handler.js";
import type { AuthService } from "./services/auth.service.js";

export class AuthModule extends BaseModule {
  public readonly id = "auth";
  public readonly name = "auth";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("auth module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("auth module stopped");
  }
}

export function registerAuthCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, auth: AuthService): void {
  registerCommandHandlers(commands, [
    new RegisterHandler(auth),
    new LoginHandler(auth),
    new SocialSignInHandler(auth),
    new LogoutHandler(auth),
    new RefreshTokenHandler(auth),
    new RequestPasswordResetHandler(auth),
    new ResetPasswordHandler(auth),
    new RevokeSessionHandler(auth),
    new SendOtpHandler(auth),
    new VerifyOtpHandler(auth),
  ]);
  registerQueryHandlers(queries, [new ListSessionsHandler(auth), new GetSessionHandler(auth), new CheckUsernameAvailabilityHandler(auth)]);
}
