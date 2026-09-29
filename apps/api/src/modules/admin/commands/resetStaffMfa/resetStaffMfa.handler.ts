import { CommandHandler } from "@zudojs/cqrs";

import type { AdminModuleServices } from "../../services/adminModule.service.js";
import { convertStaffAccountToDto, type StaffAccountDto } from "../../dtos/admin.dto.js";
import type { ResetStaffMfaCommand } from "./resetStaffMfa.command.js";

export class ResetStaffMfaHandler extends CommandHandler<ResetStaffMfaCommand, StaffAccountDto> {
  public readonly commandType = "admin.resetStaffMfa" as const;

  public constructor(private readonly service: AdminModuleServices) {
    super();
  }

  public async execute(command: ResetStaffMfaCommand): Promise<StaffAccountDto> {
    const account = await this.service.administration.resetStaffMfa(command.principal, command.targetUserId);
    return convertStaffAccountToDto(account, await this.service.staff.dependencies.users.findById(account.userId));
  }
}
