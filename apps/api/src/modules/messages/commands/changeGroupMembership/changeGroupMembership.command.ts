import { Command } from "@zudojs/cqrs";

import type { GroupMembershipChange } from "../../models/membershipChange.model.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ChangeGroupMembershipCommand extends Command<"messages.changeGroupMembership"> {
  public constructor(
    public readonly principal: Principal,
    public readonly conversationId: string,
    public readonly change: GroupMembershipChange,
  ) {
    super("messages.changeGroupMembership");
  }
}
