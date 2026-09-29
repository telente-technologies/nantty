import { Query } from "@zudojs/cqrs";

import type { NumberedPageRequest } from "../../../../utils/adminHttp.util.js";
import type { StaffAccountFilter } from "../../models/platformStaff.model.js";

export class ListAdminsQuery extends Query<"admin.listAdmins"> {
  public constructor(
    public readonly filter: StaffAccountFilter,
    public readonly page: NumberedPageRequest,
  ) {
    super("admin.listAdmins");
  }
}
