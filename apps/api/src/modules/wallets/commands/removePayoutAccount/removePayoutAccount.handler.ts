import { CommandHandler } from "@zudojs/cqrs";

import type { WalletsService } from "../../services/wallets.service.js";
import type { RemovePayoutAccountCommand } from "./removePayoutAccount.command.js";

export class RemovePayoutAccountHandler extends CommandHandler<RemovePayoutAccountCommand, void> {
  public readonly commandType = "wallets.removePayoutAccount" as const;

  public constructor(private readonly service: WalletsService) {
    super();
  }

  public execute(command: RemovePayoutAccountCommand): Promise<void> {
    return this.service.removePayoutAccount(command.principal, command.scope, command.payoutAccountId);
  }
}
