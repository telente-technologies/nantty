import { CommandHandler } from "@zudojs/cqrs";

import type { WithdrawalRecord } from "../../models/wallets.model.js";
import type { WalletsService } from "../../services/wallets.service.js";
import type { RequestWithdrawalCommand } from "./requestWithdrawal.command.js";

export class RequestWithdrawalHandler extends CommandHandler<RequestWithdrawalCommand, WithdrawalRecord> {
  public readonly commandType = "wallets.requestWithdrawal" as const;

  public constructor(private readonly service: WalletsService) {
    super();
  }

  public execute(command: RequestWithdrawalCommand): Promise<WithdrawalRecord> {
    return this.service.requestWithdrawal(command.principal.userId, command.storeId, command.amount, command.payoutAccountId);
  }
}
