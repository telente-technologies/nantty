import { CommandHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { IssuedAdminTokens } from "../../services/adminTokens.service.js";
import type { RefreshAdminSessionCommand } from "./refreshAdminSession.command.js";

export class RefreshAdminSessionHandler extends CommandHandler<RefreshAdminSessionCommand, IssuedAdminTokens> {
  public readonly commandType = "admin.refreshAdminSession" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: RefreshAdminSessionCommand): Promise<IssuedAdminTokens> {
    return this.service.signIn.refresh(command.refreshToken);
  }
}
