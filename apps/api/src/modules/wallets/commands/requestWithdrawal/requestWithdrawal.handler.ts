import { CommandHandler } from "@zudojs/cqrs";

import type { WithdrawalRecord } from "../../models/wallets.model.js";
import type { WithdrawalsService } from "../../services/withdrawals.service.js";
import type { RequestWithdrawalCommand } from "./requestWithdrawal.command.js";

export class RequestWithdrawalHandler extends CommandHandler<RequestWithdrawalCommand, WithdrawalRecord> {
  public readonly commandType = "wallets.requestWithdrawal" as const;

  public constructor(private readonly service: WithdrawalsService) {
    super();
  }

  public execute(command: RequestWithdrawalCommand): Promise<WithdrawalRecord> {
    return this.service.requestWithdrawal(command.principal, command.scope, command.amount, command.payoutAccountId);
  }
}
