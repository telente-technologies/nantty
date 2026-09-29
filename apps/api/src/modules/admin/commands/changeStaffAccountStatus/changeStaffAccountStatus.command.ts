import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ChangeStaffAccountStatusCommand extends Command<"admin.changeStaffAccountStatus"> {
  public constructor(
    public readonly principal: Principal,
    public readonly targetUserId: string,
    public readonly status: "active" | "disabled",
  ) {
    super("admin.changeStaffAccountStatus");
  }
}
