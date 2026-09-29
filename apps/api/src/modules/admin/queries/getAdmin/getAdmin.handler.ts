import { QueryHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { StaffAdministrationService } from "../../services/staffAdministration.service.js";
import type { GetAdminQuery } from "./getAdmin.query.js";

export class GetAdminHandler extends QueryHandler<GetAdminQuery, Awaited<ReturnType<StaffAdministrationService["describeAdmin"]>>> {
  public readonly queryType = "admin.getAdmin" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(query: GetAdminQuery): Promise<Awaited<ReturnType<StaffAdministrationService["describeAdmin"]>>> {
    return this.service.administration.describeAdmin(query.staffId);
  }
}
