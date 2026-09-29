import { CommandHandler } from "@zudojs/cqrs";

import type { AdAccountsService } from "../../services/adAccounts.service.js";
import type { CreateAdAccountCommand } from "./createAdAccount.command.js";

export class CreateAdAccountHandler extends CommandHandler<CreateAdAccountCommand, Awaited<ReturnType<AdAccountsService["createAccount"]>>> {
  public readonly commandType = "ads.createAdAccount" as const;

  public constructor(private readonly accountsService: AdAccountsService) {
    super();
  }

  public execute(command: CreateAdAccountCommand): Promise<Awaited<ReturnType<AdAccountsService["createAccount"]>>> {
    return this.accountsService.createAccount(command.principal.userId, command.input);
  }
}
