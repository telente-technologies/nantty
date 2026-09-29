import { QueryHandler } from "@zudojs/cqrs";

import type { PersonalWalletSummary, StoreWalletSummary } from "../../services/wallets.service.js";
import type { WalletsService } from "../../services/wallets.service.js";
import type { GetWalletQuery } from "./getWallet.query.js";

export class GetWalletHandler extends QueryHandler<GetWalletQuery, StoreWalletSummary | PersonalWalletSummary> {
  public readonly queryType = "wallets.getWallet" as const;

  public constructor(private readonly service: WalletsService) {
    super();
  }

  public execute(query: GetWalletQuery): Promise<StoreWalletSummary | PersonalWalletSummary> {
    return this.service.getWallet(query.principal, query.scope);
  }
}
