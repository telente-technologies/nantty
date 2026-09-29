import { CommandHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { RemoveAdminPasskeyCommand } from "./removeAdminPasskey.command.js";

export class RemoveAdminPasskeyHandler extends CommandHandler<RemoveAdminPasskeyCommand, void> {
  public readonly commandType = "admin.removeAdminPasskey" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public async execute(command: RemoveAdminPasskeyCommand): Promise<void> {
    await this.service.selfService.removePasskey(command.staff.account, command.passkeyId);
  }
}
