import { CommandHandler } from "@zudojs/cqrs";

import type { AdInvitesService } from "../../services/adInvites.service.js";
import type { CreateAdInviteCommand } from "./createAdInvite.command.js";

export class CreateAdInviteHandler extends CommandHandler<CreateAdInviteCommand, Awaited<ReturnType<AdInvitesService["createInvite"]>>> {
  public readonly commandType = "ads.createAdInvite" as const;

  public constructor(private readonly invitesService: AdInvitesService) {
    super();
  }

  public execute(command: CreateAdInviteCommand): Promise<Awaited<ReturnType<AdInvitesService["createInvite"]>>> {
    return this.invitesService.createInvite(command.principal.userId, command.accountId, command.email, command.role);
  }
}
