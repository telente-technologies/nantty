import { Query } from "@zudojs/cqrs";

import type { AffiliateTarget } from "../../services/affiliations.service.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListAffiliateCommissionsQuery extends Query<"creators.listAffiliateCommissions"> {
  public constructor(
    public readonly principal: Principal,
    public readonly target: AffiliateTarget,
  ) {
    super("creators.listAffiliateCommissions");
  }
}
