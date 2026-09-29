import { CommandHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { CreateAdminSignInPasskeyOptionsCommand } from "./createAdminSignInPasskeyOptions.command.js";

export class CreateAdminSignInPasskeyOptionsHandler extends CommandHandler<CreateAdminSignInPasskeyOptionsCommand, unknown> {
  public readonly commandType = "admin.createAdminSignInPasskeyOptions" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: CreateAdminSignInPasskeyOptionsCommand): Promise<unknown> {
    return this.service.signIn.createSignInPasskeyOptions(command.mfaToken);
  }
}
