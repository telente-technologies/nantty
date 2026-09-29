import { CommandHandler } from "@zudojs/cqrs";

import type { AdminModuleServices } from "../../services/adminModule.service.js";
import { convertStaffAccountToDto, type StaffAccountDto } from "../../dtos/admin.dto.js";
import type { UpdateStaffAccountCommand } from "./updateStaffAccount.command.js";

export class UpdateStaffAccountHandler extends CommandHandler<UpdateStaffAccountCommand, StaffAccountDto> {
  public readonly commandType = "admin.updateStaffAccount" as const;

  public constructor(private readonly service: AdminModuleServices) {
    super();
  }

  public async execute(command: UpdateStaffAccountCommand): Promise<StaffAccountDto> {
    const account = await this.service.administration.updateStaffAccount(command.principal, command.targetUserId, command.input);
    return convertStaffAccountToDto(account, await this.service.staff.dependencies.users.findById(account.userId));
  }
}
