import { CommandHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { PasskeyDto } from "../../services/staffSelfService.service.js";
import type { AddAdminPasskeyCommand } from "./addAdminPasskey.command.js";

export class AddAdminPasskeyHandler extends CommandHandler<AddAdminPasskeyCommand, PasskeyDto> {
  public readonly commandType = "admin.addAdminPasskey" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: AddAdminPasskeyCommand): Promise<PasskeyDto> {
    return this.service.selfService.addPasskey(command.staff.account, command.staff.session, command.label, command.credential);
  }
}
