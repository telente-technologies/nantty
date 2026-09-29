import { CommandHandler } from "@zudojs/cqrs";

import type { AdminModuleServices } from "../../services/adminModule.service.js";
import type { RegenerateAdminRecoveryCodesCommand } from "./regenerateAdminRecoveryCodes.command.js";

export class RegenerateAdminRecoveryCodesHandler extends CommandHandler<RegenerateAdminRecoveryCodesCommand, { readonly recoveryCodes: readonly string[] }> {
  public readonly commandType = "admin.regenerateAdminRecoveryCodes" as const;

  public constructor(private readonly service: AdminModuleServices) {
    super();
  }

  public async execute(command: RegenerateAdminRecoveryCodesCommand): Promise<{ readonly recoveryCodes: readonly string[] }> {
    const { staff } = this.service;
    const { account } = await staff.findVerifiedStaffSessionOrThrow(command.principal);
    const recoveryCodes = await staff.dependencies.mfa.regenerateRecoveryCodes(account);
    await staff.dependencies.audit.record({ actorId: account.userId, action: "admin.recovery_codes_regenerated", entityType: "platform_staff_account", entityId: account.userId });
    return { recoveryCodes };
  }
}
