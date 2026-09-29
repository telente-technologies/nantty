import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RemoveAdMemberCommand extends Command<"ads.removeAdMember"> {
  public constructor(
    public readonly principal: Principal,
    public readonly accountId: string,
    public readonly memberUserId: string,
  ) {
    super("ads.removeAdMember");
  }
}
