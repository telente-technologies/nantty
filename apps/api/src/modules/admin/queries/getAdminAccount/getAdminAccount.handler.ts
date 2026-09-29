import { QueryHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { StaffSelfService } from "../../services/staffSelfService.service.js";
import type { GetAdminAccountQuery } from "./getAdminAccount.query.js";

export class GetAdminAccountHandler extends QueryHandler<GetAdminAccountQuery, Awaited<ReturnType<StaffSelfService["describeAccount"]>>> {
  public readonly queryType = "admin.getAdminAccount" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(query: GetAdminAccountQuery): Promise<Awaited<ReturnType<StaffSelfService["describeAccount"]>>> {
    return this.service.selfService.describeAccount(query.staff.account);
  }
}
