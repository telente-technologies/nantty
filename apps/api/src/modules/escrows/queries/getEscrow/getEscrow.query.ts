import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetEscrowQuery extends Query<"escrows.getEscrow"> {
  public constructor(
    public readonly principal: Principal,
    public readonly orderId: string,
  ) {
    super("escrows.getEscrow");
  }
}
