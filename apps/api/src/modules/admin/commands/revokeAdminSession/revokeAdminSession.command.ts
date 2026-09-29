import { Command } from "@zudojs/cqrs";

import type { StaffRequestState } from "../../services/staffRequestGuard.service.js";

export class RevokeAdminSessionCommand extends Command<"admin.revokeAdminSession"> {
  public constructor(
    public readonly staff: StaffRequestState,
    public readonly sessionId: string,
  ) {
    super("admin.revokeAdminSession");
  }
}
