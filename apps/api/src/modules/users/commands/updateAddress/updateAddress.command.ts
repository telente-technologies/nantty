import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { UpdateAddressBody } from "../../validators/users.validator.js";

export class UpdateAddressCommand extends Command<"users.updateAddress"> {
  public constructor(
    public readonly principal: Principal,
    public readonly addressId: string,
    public readonly changes: UpdateAddressBody,
  ) {
    super("users.updateAddress");
  }
}
