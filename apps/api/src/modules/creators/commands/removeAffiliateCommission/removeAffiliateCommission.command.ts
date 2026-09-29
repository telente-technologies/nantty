import { Command } from "@zudojs/cqrs";

import type { AffiliateTarget } from "../../services/affiliations.service.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RemoveAffiliateCommissionCommand extends Command<"creators.removeAffiliateCommission"> {
  public constructor(
    public readonly principal: Principal,
    public readonly target: AffiliateTarget,
  ) {
    super("creators.removeAffiliateCommission");
  }
}
