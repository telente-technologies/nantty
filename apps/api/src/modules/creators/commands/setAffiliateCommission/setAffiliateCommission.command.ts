import { Command } from "@zudojs/cqrs";

import type { AffiliateTarget } from "../../services/affiliations.service.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class SetAffiliateCommissionCommand extends Command<"creators.setAffiliateCommission"> {
  public constructor(
    public readonly principal: Principal,
    public readonly target: AffiliateTarget,
    public readonly commissionBps: number,
  ) {
    super("creators.setAffiliateCommission");
  }
}
