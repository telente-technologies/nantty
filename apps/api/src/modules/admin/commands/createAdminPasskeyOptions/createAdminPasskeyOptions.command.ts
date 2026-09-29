import { Command } from "@zudojs/cqrs";

import type { StaffRequestState } from "../../services/staffRequestGuard.service.js";

export class CreateAdminPasskeyOptionsCommand extends Command<"admin.createAdminPasskeyOptions"> {
  public constructor(
    public readonly staff: StaffRequestState,
  ) {
    super("admin.createAdminPasskeyOptions");
  }
}
