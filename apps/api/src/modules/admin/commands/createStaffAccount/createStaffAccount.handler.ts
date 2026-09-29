import { CommandHandler } from "@zudojs/cqrs";

import type { AdminModuleServices } from "../../services/adminModule.service.js";
import { convertStaffAccountToDto, type StaffAccountDto } from "../../dtos/admin.dto.js";
import type { CreateStaffAccountCommand } from "./createStaffAccount.command.js";

export class CreateStaffAccountHandler extends CommandHandler<CreateStaffAccountCommand, StaffAccountDto> {
  public readonly commandType = "admin.createStaffAccount" as const;

  public constructor(private readonly service: AdminModuleServices) {
    super();
  }

  public async execute(command: CreateStaffAccountCommand): Promise<StaffAccountDto> {
    const account = await this.service.administration.createStaffAccount(command.principal, command.input);
    return convertStaffAccountToDto(account, await this.service.staff.dependencies.users.findById(account.userId));
  }
}
