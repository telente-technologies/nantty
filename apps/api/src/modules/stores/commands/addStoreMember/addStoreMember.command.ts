import { Command } from "@zudojs/cqrs";

import type { AddStoreMemberBody } from "../../validators/stores.validator.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class AddStoreMemberCommand extends Command<"stores.addStoreMember"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly input: AddStoreMemberBody,
  ) {
    super("stores.addStoreMember");
  }
}
