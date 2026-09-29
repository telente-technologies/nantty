import { CommandHandler } from "@zudojs/cqrs";

import type { AdminAccountSummaryDto } from "../../services/platformStaff.service.js";
import type { AdminServices } from "../../services/adminServices.service.js";
import type { ChangeAdminPermissionsCommand } from "./changeAdminPermissions.command.js";

export class ChangeAdminPermissionsHandler extends CommandHandler<ChangeAdminPermissionsCommand, { readonly admin: AdminAccountSummaryDto }> {
  public readonly commandType = "admin.changeAdminPermissions" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: ChangeAdminPermissionsCommand): Promise<{ readonly admin: AdminAccountSummaryDto }> {
    return this.service.administration.changePermissions(command.staff.account, command.staffId, command.role, command.permissions, command.reason);
  }
}
