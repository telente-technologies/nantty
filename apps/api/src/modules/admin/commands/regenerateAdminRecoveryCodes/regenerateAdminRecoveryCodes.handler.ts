import { CommandHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { RegenerateAdminRecoveryCodesCommand } from "./regenerateAdminRecoveryCodes.command.js";

export class RegenerateAdminRecoveryCodesHandler extends CommandHandler<RegenerateAdminRecoveryCodesCommand, { readonly recoveryCodes: readonly string[] }> {
  public readonly commandType = "admin.regenerateAdminRecoveryCodes" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: RegenerateAdminRecoveryCodesCommand): Promise<{ readonly recoveryCodes: readonly string[] }> {
    return this.service.selfService.regenerateRecoveryCodes(command.staff.account);
  }
}
