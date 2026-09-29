import { CommandHandler } from "@zudojs/cqrs";

import type { AdAccountsService } from "../../services/adAccounts.service.js";
import type { RemoveAdMemberCommand } from "./removeAdMember.command.js";

export class RemoveAdMemberHandler extends CommandHandler<RemoveAdMemberCommand, Awaited<ReturnType<AdAccountsService["removeMember"]>>> {
  public readonly commandType = "ads.removeAdMember" as const;

  public constructor(private readonly accountsService: AdAccountsService) {
    super();
  }

  public execute(command: RemoveAdMemberCommand): Promise<Awaited<ReturnType<AdAccountsService["removeMember"]>>> {
    return this.accountsService.removeMember(command.principal.userId, command.accountId, command.memberUserId);
  }
}
