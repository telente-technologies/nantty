import { Query } from "@zudojs/cqrs";

import type { StaffRequestState } from "../../services/staffRequestGuard.service.js";

export class GetAdminAccountQuery extends Query<"admin.getAdminAccount"> {
  public constructor(
    public readonly staff: StaffRequestState,
  ) {
    super("admin.getAdminAccount");
  }
}
