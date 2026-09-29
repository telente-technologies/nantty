import { Query } from "@zudojs/cqrs";

import type { AuditEventFilter } from "../../../audit/models/audit.model.js";
import type { NumberedPageRequest } from "../../../../utils/adminHttp.util.js";

export class ListAdminAuditLogQuery extends Query<"admin.listAdminAuditLog"> {
  public constructor(
    public readonly filter: AuditEventFilter,
    public readonly page: NumberedPageRequest,
  ) {
    super("admin.listAdminAuditLog");
  }
}
