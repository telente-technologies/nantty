import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RemoveAddressCommand extends Command<"users.removeAddress"> {
  public constructor(
    public readonly principal: Principal,
    public readonly addressId: string,
  ) {
    super("users.removeAddress");
  }
}
