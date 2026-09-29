import { Command } from "@zudojs/cqrs";

import type { NewAdminRequest } from "../../services/staffAdministration.service.js";
import type { StaffRequestState } from "../../services/staffRequestGuard.service.js";

export class InviteAdminCommand extends Command<"admin.inviteAdmin"> {
  public constructor(
    public readonly staff: StaffRequestState,
    public readonly input: NewAdminRequest,
  ) {
    super("admin.inviteAdmin");
  }
}
