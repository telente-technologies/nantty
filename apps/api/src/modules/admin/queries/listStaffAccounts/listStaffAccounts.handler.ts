import { QueryHandler } from "@zudojs/cqrs";

import type { AdminModuleServices } from "../../services/adminModule.service.js";
import { convertStaffAccountToDto, type StaffAccountDto } from "../../dtos/admin.dto.js";
import type { ListStaffAccountsQuery } from "./listStaffAccounts.query.js";

export class ListStaffAccountsHandler extends QueryHandler<ListStaffAccountsQuery, readonly StaffAccountDto[]> {
  public readonly queryType = "admin.listStaffAccounts" as const;

  public constructor(private readonly service: AdminModuleServices) {
    super();
  }

  public async execute(): Promise<readonly StaffAccountDto[]> {
    const { accounts, users } = this.service.staff.dependencies;
    const all = await accounts.listAll();
    const people = new Map((await users.findManyByIds(all.map((account) => account.userId))).map((user) => [user.id, user]));
    return all.map((account) => convertStaffAccountToDto(account, people.get(account.userId)));
  }
}
