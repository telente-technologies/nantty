import { CommandHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { CreateAdminPasskeyOptionsCommand } from "./createAdminPasskeyOptions.command.js";

export class CreateAdminPasskeyOptionsHandler extends CommandHandler<CreateAdminPasskeyOptionsCommand, unknown> {
  public readonly commandType = "admin.createAdminPasskeyOptions" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: CreateAdminPasskeyOptionsCommand): Promise<unknown> {
    return this.service.selfService.createPasskeyRegistrationOptions(command.staff.account, command.staff.session);
  }
}
