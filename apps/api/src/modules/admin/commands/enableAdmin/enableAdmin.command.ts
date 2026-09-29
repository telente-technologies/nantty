import { Command } from "@zudojs/cqrs";

import type { StaffRequestState } from "../../services/staffRequestGuard.service.js";

export class EnableAdminCommand extends Command<"admin.enableAdmin"> {
  public constructor(
    public readonly staff: StaffRequestState,
    public readonly staffId: string,
    public readonly reason: string,
  ) {
    super("admin.enableAdmin");
  }
}
