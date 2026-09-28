import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { UpdateProfileBody } from "../../validators/users.validator.js";

export class UpdateProfileCommand extends Command<"users.updateProfile"> {
  public constructor(
    public readonly principal: Principal,
    public readonly changes: UpdateProfileBody,
  ) {
    super("users.updateProfile");
  }
}
