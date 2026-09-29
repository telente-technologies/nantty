import { Command } from "@zudojs/cqrs";

import type { AdAccountRole } from "../../models/adAccounts.model.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CreateAdInviteCommand extends Command<"ads.createAdInvite"> {
  public constructor(
    public readonly principal: Principal,
    public readonly accountId: string,
    public readonly email: string,
    public readonly role: AdAccountRole,
  ) {
    super("ads.createAdInvite");
  }
}
