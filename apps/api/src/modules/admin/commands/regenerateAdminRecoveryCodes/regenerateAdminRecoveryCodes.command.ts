import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RegenerateAdminRecoveryCodesCommand extends Command<"admin.regenerateAdminRecoveryCodes"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("admin.regenerateAdminRecoveryCodes");
  }
}
