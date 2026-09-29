import { QueryHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { StaffSelfService } from "../../services/staffSelfService.service.js";
import type { ListAdminSessionsQuery } from "./listAdminSessions.query.js";

export class ListAdminSessionsHandler extends QueryHandler<ListAdminSessionsQuery, Awaited<ReturnType<StaffSelfService["listSessions"]>>> {
  public readonly queryType = "admin.listAdminSessions" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(query: ListAdminSessionsQuery): Promise<Awaited<ReturnType<StaffSelfService["listSessions"]>>> {
    return this.service.selfService.listSessions(query.staff.account, query.staff.session.id);
  }
}
