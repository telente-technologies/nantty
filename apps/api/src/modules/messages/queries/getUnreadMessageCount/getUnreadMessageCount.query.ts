import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetUnreadMessageCountQuery extends Query<"messages.getUnreadMessageCount"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("messages.getUnreadMessageCount");
  }
}
