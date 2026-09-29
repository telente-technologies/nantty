import { CommandHandler } from "@zudojs/cqrs";

import type { AdAccountsService } from "../../services/adAccounts.service.js";
import type { ChangeAdMemberRoleCommand } from "./changeAdMemberRole.command.js";

export class ChangeAdMemberRoleHandler extends CommandHandler<ChangeAdMemberRoleCommand, Awaited<ReturnType<AdAccountsService["changeMemberRole"]>>> {
  public readonly commandType = "ads.changeAdMemberRole" as const;

  public constructor(private readonly accountsService: AdAccountsService) {
    super();
  }

  public execute(command: ChangeAdMemberRoleCommand): Promise<Awaited<ReturnType<AdAccountsService["changeMemberRole"]>>> {
    return this.accountsService.changeMemberRole(command.principal.userId, command.accountId, command.memberUserId, command.role);
  }
}
