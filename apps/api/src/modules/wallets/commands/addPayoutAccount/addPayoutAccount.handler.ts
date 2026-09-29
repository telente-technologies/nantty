import { CommandHandler } from "@zudojs/cqrs";

import type { PayoutAccountRecord } from "../../models/wallets.model.js";
import type { WalletsService } from "../../services/wallets.service.js";
import type { AddPayoutAccountCommand } from "./addPayoutAccount.command.js";

export class AddPayoutAccountHandler extends CommandHandler<AddPayoutAccountCommand, PayoutAccountRecord> {
  public readonly commandType = "wallets.addPayoutAccount" as const;

  public constructor(private readonly service: WalletsService) {
    super();
  }

  public execute(command: AddPayoutAccountCommand): Promise<PayoutAccountRecord> {
    return this.service.addPayoutAccount(command.principal.userId, command.storeId, command.input);
  }
}
