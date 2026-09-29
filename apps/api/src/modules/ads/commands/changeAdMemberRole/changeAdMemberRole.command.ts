import { Command } from "@zudojs/cqrs";

import type { AdAccountRole } from "../../models/adAccounts.model.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ChangeAdMemberRoleCommand extends Command<"ads.changeAdMemberRole"> {
  public constructor(
    public readonly principal: Principal,
    public readonly accountId: string,
    public readonly memberUserId: string,
    public readonly role: AdAccountRole,
  ) {
    super("ads.changeAdMemberRole");
  }
}
