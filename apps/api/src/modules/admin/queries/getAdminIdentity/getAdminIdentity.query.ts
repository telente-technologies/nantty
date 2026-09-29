import { Query } from "@zudojs/cqrs";

import type { StaffRequestState } from "../../services/staffRequestGuard.service.js";

export class GetAdminIdentityQuery extends Query<"admin.getAdminIdentity"> {
  public constructor(
    public readonly staff: StaffRequestState,
  ) {
    super("admin.getAdminIdentity");
  }
}
