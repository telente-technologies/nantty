import { CommandHandler } from "@zudojs/cqrs";

import type { AdInvitesService } from "../../services/adInvites.service.js";
import type { AcceptAdInviteCommand } from "./acceptAdInvite.command.js";

export class AcceptAdInviteHandler extends CommandHandler<AcceptAdInviteCommand, Awaited<ReturnType<AdInvitesService["acceptInvite"]>>> {
  public readonly commandType = "ads.acceptAdInvite" as const;

  public constructor(private readonly invitesService: AdInvitesService) {
    super();
  }

  public execute(command: AcceptAdInviteCommand): Promise<Awaited<ReturnType<AdInvitesService["acceptInvite"]>>> {
    return this.invitesService.acceptInvite(command.principal.userId, command.token);
  }
}
