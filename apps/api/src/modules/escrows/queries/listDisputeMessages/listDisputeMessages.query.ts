import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListDisputeMessagesQuery extends Query<"escrows.listDisputeMessages"> {
  public constructor(
    public readonly principal: Principal,
    public readonly disputeId: string,
  ) {
    super("escrows.listDisputeMessages");
  }
}
