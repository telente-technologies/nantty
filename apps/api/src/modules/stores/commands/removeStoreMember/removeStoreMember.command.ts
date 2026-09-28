import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RemoveStoreMemberCommand extends Command<"stores.removeStoreMember"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly memberUserId: string,
  ) {
    super("stores.removeStoreMember");
  }
}
