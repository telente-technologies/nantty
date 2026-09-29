import { QueryHandler } from "@zudojs/cqrs";

import type { AdminAccountSummaryDto } from "../../services/platformStaff.service.js";
import type { AdminServices } from "../../services/adminServices.service.js";
import type { NumberedPage } from "../../../../utils/adminHttp.util.js";
import type { ListAdminsQuery } from "./listAdmins.query.js";

export class ListAdminsHandler extends QueryHandler<ListAdminsQuery, NumberedPage<AdminAccountSummaryDto>> {
  public readonly queryType = "admin.listAdmins" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(query: ListAdminsQuery): Promise<NumberedPage<AdminAccountSummaryDto>> {
    return this.service.administration.listAdmins(query.filter, query.page);
  }
}
