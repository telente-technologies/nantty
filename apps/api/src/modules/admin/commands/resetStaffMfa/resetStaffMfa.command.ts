import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ResetStaffMfaCommand extends Command<"admin.resetStaffMfa"> {
  public constructor(
    public readonly principal: Principal,
    public readonly targetUserId: string,
  ) {
    super("admin.resetStaffMfa");
  }
}
