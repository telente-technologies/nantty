import { CommandHandler } from "@zudojs/cqrs";

import type { AdminAccountSummaryDto } from "../../services/platformStaff.service.js";
import type { AdminServices } from "../../services/adminServices.service.js";
import type { DisableAdminCommand } from "./disableAdmin.command.js";

export class DisableAdminHandler extends CommandHandler<DisableAdminCommand, { readonly admin: AdminAccountSummaryDto }> {
  public readonly commandType = "admin.disableAdmin" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: DisableAdminCommand): Promise<{ readonly admin: AdminAccountSummaryDto }> {
    return this.service.administration.disableAdmin(command.staff.account, command.staffId, command.reason);
  }
}
