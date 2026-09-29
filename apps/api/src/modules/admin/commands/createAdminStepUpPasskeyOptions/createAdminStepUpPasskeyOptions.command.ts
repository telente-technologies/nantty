import { Command } from "@zudojs/cqrs";

import type { StaffRequestState } from "../../services/staffRequestGuard.service.js";

export class CreateAdminStepUpPasskeyOptionsCommand extends Command<"admin.createAdminStepUpPasskeyOptions"> {
  public constructor(
    public readonly staff: StaffRequestState,
  ) {
    super("admin.createAdminStepUpPasskeyOptions");
  }
}
