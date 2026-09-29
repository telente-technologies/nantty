import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetWalletQuery extends Query<"wallets.getWallet"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string | undefined,
  ) {
    super("wallets.getWallet");
  }
}
