import { CommandHandler } from "@zudojs/cqrs";

import type { AdminAccountSummaryDto } from "../../services/platformStaff.service.js";
import type { AdminServices } from "../../services/adminServices.service.js";
import type { ResetAdminMfaCommand } from "./resetAdminMfa.command.js";

export class ResetAdminMfaHandler extends CommandHandler<ResetAdminMfaCommand, { readonly admin: AdminAccountSummaryDto }> {
  public readonly commandType = "admin.resetAdminMfa" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: ResetAdminMfaCommand): Promise<{ readonly admin: AdminAccountSummaryDto }> {
    return this.service.administration.resetMfa(command.staff.account, command.staffId, command.reason);
  }
}
