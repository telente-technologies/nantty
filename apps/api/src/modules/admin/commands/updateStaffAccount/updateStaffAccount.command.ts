import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { UpdateStaffAccountBody } from "../../validators/admin.validator.js";

export class UpdateStaffAccountCommand extends Command<"admin.updateStaffAccount"> {
  public constructor(
    public readonly principal: Principal,
    public readonly targetUserId: string,
    public readonly input: UpdateStaffAccountBody,
  ) {
    super("admin.updateStaffAccount");
  }
}
