import { Command } from "@zudojs/cqrs";

import type { StaffRequestState } from "../../services/staffRequestGuard.service.js";

export class RegenerateAdminRecoveryCodesCommand extends Command<"admin.regenerateAdminRecoveryCodes"> {
  public constructor(
    public readonly staff: StaffRequestState,
  ) {
    super("admin.regenerateAdminRecoveryCodes");
  }
}
