import { QueryHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { AuditFacets } from "../../../audit/repositories/audit.repository.js";
import type { GetAdminAuditFacetsQuery } from "./getAdminAuditFacets.query.js";

export class GetAdminAuditFacetsHandler extends QueryHandler<GetAdminAuditFacetsQuery, AuditFacets> {
  public readonly queryType = "admin.getAdminAuditFacets" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(): Promise<AuditFacets> {
    return this.service.staff.dependencies.auditLog.findFacets();
  }
}
