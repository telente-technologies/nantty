import { Command } from "@zudojs/cqrs";

import type { AffiliateTarget } from "../../services/affiliations.service.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ChangeCreatorAffiliationCommand extends Command<"creators.changeCreatorAffiliation"> {
  public constructor(
    public readonly principal: Principal,
    public readonly target: AffiliateTarget,
    public readonly affiliated: boolean,
  ) {
    super("creators.changeCreatorAffiliation");
  }
}
