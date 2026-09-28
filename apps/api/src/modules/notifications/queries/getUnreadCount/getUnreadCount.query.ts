import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetUnreadCountQuery extends Query<"notifications.getUnreadCount"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("notifications.getUnreadCount");
  }
}
