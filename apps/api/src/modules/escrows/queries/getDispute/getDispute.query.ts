import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetDisputeQuery extends Query<"escrows.getDispute"> {
  public constructor(
    public readonly principal: Principal,
    public readonly disputeId: string,
  ) {
    super("escrows.getDispute");
  }
}
