import { CommandHandler } from "@zudojs/cqrs";

import type { AdminModuleServices } from "../../services/adminModule.service.js";
import { convertStaffAccountToDto, type StaffAccountDto } from "../../dtos/admin.dto.js";
import type { ChangeStaffAccountStatusCommand } from "./changeStaffAccountStatus.command.js";

export class ChangeStaffAccountStatusHandler extends CommandHandler<ChangeStaffAccountStatusCommand, StaffAccountDto> {
  public readonly commandType = "admin.changeStaffAccountStatus" as const;

  public constructor(private readonly service: AdminModuleServices) {
    super();
  }

  public async execute(command: ChangeStaffAccountStatusCommand): Promise<StaffAccountDto> {
    const account = await this.service.administration.changeStaffAccountStatus(command.principal, command.targetUserId, command.status);
    return convertStaffAccountToDto(account, await this.service.staff.dependencies.users.findById(account.userId));
  }
}
