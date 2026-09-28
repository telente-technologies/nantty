import { Command } from "@zudojs/cqrs";

import type { AddressBody } from "../../validators/users.validator.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class AddAddressCommand extends Command<"users.addAddress"> {
  public constructor(
    public readonly principal: Principal,
    public readonly input: AddressBody,
  ) {
    super("users.addAddress");
  }
}
