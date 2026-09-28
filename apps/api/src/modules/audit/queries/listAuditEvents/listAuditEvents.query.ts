import { Query } from "@zudojs/cqrs";

import type { AuditEventFilter } from "../../models/audit.model.js";
import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListAuditEventsQuery extends Query<"audit.listAuditEvents"> {
  public constructor(
    public readonly filter: AuditEventFilter,
    public readonly page: PageRequest,
  ) {
    super("audit.listAuditEvents");
  }
}
