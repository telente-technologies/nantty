import { CommandHandler } from "@zudojs/cqrs";

import type { AdInvitesService } from "../../services/adInvites.service.js";
import type { RevokeAdInviteCommand } from "./revokeAdInvite.command.js";

export class RevokeAdInviteHandler extends CommandHandler<RevokeAdInviteCommand, Awaited<ReturnType<AdInvitesService["revokeInvite"]>>> {
  public readonly commandType = "ads.revokeAdInvite" as const;

  public constructor(private readonly invitesService: AdInvitesService) {
    super();
  }

  public execute(command: RevokeAdInviteCommand): Promise<Awaited<ReturnType<AdInvitesService["revokeInvite"]>>> {
    return this.invitesService.revokeInvite(command.principal.userId, command.accountId, command.inviteId);
  }
}
