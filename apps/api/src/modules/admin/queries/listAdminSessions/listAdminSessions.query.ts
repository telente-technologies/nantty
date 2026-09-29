import { Query } from "@zudojs/cqrs";

import type { StaffRequestState } from "../../services/staffRequestGuard.service.js";

export class ListAdminSessionsQuery extends Query<"admin.listAdminSessions"> {
  public constructor(
    public readonly staff: StaffRequestState,
  ) {
    super("admin.listAdminSessions");
  }
}
