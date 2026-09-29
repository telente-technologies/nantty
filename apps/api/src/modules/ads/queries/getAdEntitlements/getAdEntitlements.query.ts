import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetAdEntitlementsQuery extends Query<"ads.getAdEntitlements"> {
  public constructor(
    public readonly principal: Principal,
    public readonly accountId: string,
  ) {
    super("ads.getAdEntitlements");
  }
}
