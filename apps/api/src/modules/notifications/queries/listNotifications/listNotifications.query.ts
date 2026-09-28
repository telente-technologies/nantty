import { Query } from "@zudojs/cqrs";

import type { NotificationFilter } from "../../models/notifications.model.js";
import type { PageRequest } from "../../../../types/pagination.type.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListNotificationsQuery extends Query<"notifications.listNotifications"> {
  public constructor(
    public readonly principal: Principal,
    public readonly filter: NotificationFilter,
    public readonly page: PageRequest,
  ) {
    super("notifications.listNotifications");
  }
}
