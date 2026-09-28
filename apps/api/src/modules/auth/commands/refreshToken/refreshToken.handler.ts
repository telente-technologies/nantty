import { CommandHandler } from "@zudojs/cqrs";

import type { IssuedTokens } from "../../models/auth.model.js";
import type { AuthService } from "../../services/auth.service.js";
import type { RefreshTokenCommand } from "./refreshToken.command.js";

export class RefreshTokenHandler extends CommandHandler<RefreshTokenCommand, IssuedTokens> {
  public readonly commandType = "auth.refreshToken" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public execute(command: RefreshTokenCommand): Promise<IssuedTokens> {
    return this.auth.dependencies.tokens.rotateRefreshToken(command.refreshToken);
  }
}
