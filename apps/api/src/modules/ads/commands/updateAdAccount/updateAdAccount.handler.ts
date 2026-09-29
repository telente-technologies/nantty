import { CommandHandler } from "@zudojs/cqrs";

import type { AdAccountsService } from "../../services/adAccounts.service.js";
import type { UpdateAdAccountCommand } from "./updateAdAccount.command.js";

export class UpdateAdAccountHandler extends CommandHandler<UpdateAdAccountCommand, Awaited<ReturnType<AdAccountsService["updateAccount"]>>> {
  public readonly commandType = "ads.updateAdAccount" as const;

  public constructor(private readonly accountsService: AdAccountsService) {
    super();
  }

  public execute(command: UpdateAdAccountCommand): Promise<Awaited<ReturnType<AdAccountsService["updateAccount"]>>> {
    return this.accountsService.updateAccount(command.principal.userId, command.accountId, command.changes);
  }
}
