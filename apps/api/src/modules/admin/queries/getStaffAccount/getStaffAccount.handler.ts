import { QueryHandler } from "@zudojs/cqrs";

import type { AdminModuleServices } from "../../services/adminModule.service.js";
import { convertStaffAccountToDto, type StaffAccountDto } from "../../dtos/admin.dto.js";
import type { GetStaffAccountQuery } from "./getStaffAccount.query.js";

export class GetStaffAccountHandler extends QueryHandler<GetStaffAccountQuery, StaffAccountDto> {
  public readonly queryType = "admin.getStaffAccount" as const;

  public constructor(private readonly service: AdminModuleServices) {
    super();
  }

  public async execute(query: GetStaffAccountQuery): Promise<StaffAccountDto> {
    const account = await this.service.staff.findStaffAccountOrThrow(query.targetUserId);
    return convertStaffAccountToDto(account, await this.service.staff.dependencies.users.findById(account.userId));
  }
}
