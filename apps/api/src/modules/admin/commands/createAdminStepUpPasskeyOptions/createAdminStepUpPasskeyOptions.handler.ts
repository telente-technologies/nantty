import { CommandHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { CreateAdminStepUpPasskeyOptionsCommand } from "./createAdminStepUpPasskeyOptions.command.js";

export class CreateAdminStepUpPasskeyOptionsHandler extends CommandHandler<CreateAdminStepUpPasskeyOptionsCommand, unknown> {
  public readonly commandType = "admin.createAdminStepUpPasskeyOptions" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: CreateAdminStepUpPasskeyOptionsCommand): Promise<unknown> {
    return this.service.signIn.createStepUpPasskeyOptions(command.staff.account, command.staff.session);
  }
}
