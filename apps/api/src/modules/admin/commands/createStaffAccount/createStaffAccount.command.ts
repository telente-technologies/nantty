import { Command } from "@zudojs/cqrs";

import type { CreateStaffAccountBody } from "../../validators/admin.validator.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CreateStaffAccountCommand extends Command<"admin.createStaffAccount"> {
  public constructor(
    public readonly principal: Principal,
    public readonly input: CreateStaffAccountBody,
  ) {
    super("admin.createStaffAccount");
  }
}
