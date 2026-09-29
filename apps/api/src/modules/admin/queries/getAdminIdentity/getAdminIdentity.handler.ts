import { QueryHandler } from "@zudojs/cqrs";

import type { AdminIdentityDto } from "../../services/platformStaff.service.js";
import type { AdminServices } from "../../services/adminServices.service.js";
import type { GetAdminIdentityQuery } from "./getAdminIdentity.query.js";

export class GetAdminIdentityHandler extends QueryHandler<GetAdminIdentityQuery, AdminIdentityDto> {
  public readonly queryType = "admin.getAdminIdentity" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public async execute(query: GetAdminIdentityQuery): Promise<AdminIdentityDto> {
    return this.service.staff.presentIdentity(query.staff.account);
  }
}
