import { CommandHandler } from "@zudojs/cqrs";

import type { AdminAccountSummaryDto } from "../../services/platformStaff.service.js";
import type { AdminServices } from "../../services/adminServices.service.js";
import type { EnableAdminCommand } from "./enableAdmin.command.js";

export class EnableAdminHandler extends CommandHandler<EnableAdminCommand, { readonly admin: AdminAccountSummaryDto }> {
  public readonly commandType = "admin.enableAdmin" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: EnableAdminCommand): Promise<{ readonly admin: AdminAccountSummaryDto }> {
    return this.service.administration.enableAdmin(command.staff.account, command.staffId, command.reason);
  }
}
