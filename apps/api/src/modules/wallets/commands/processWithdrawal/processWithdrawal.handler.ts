import { CommandHandler } from "@zudojs/cqrs";

import type { WithdrawalRecord } from "../../models/wallets.model.js";
import type { WalletsService } from "../../services/wallets.service.js";
import type { ProcessWithdrawalCommand } from "./processWithdrawal.command.js";

export class ProcessWithdrawalHandler extends CommandHandler<ProcessWithdrawalCommand, WithdrawalRecord> {
  public readonly commandType = "wallets.processWithdrawal" as const;

  public constructor(private readonly service: WalletsService) {
    super();
  }

  public execute(command: ProcessWithdrawalCommand): Promise<WithdrawalRecord> {
    return this.service.processWithdrawal(command.principal.userId, command.withdrawalId);
  }
}
