import { QueryHandler } from "@zudojs/cqrs";

import type { StoreWalletSummary } from "../../services/wallets.service.js";
import type { WalletsService } from "../../services/wallets.service.js";
import type { GetWalletQuery } from "./getWallet.query.js";

export class GetWalletHandler extends QueryHandler<GetWalletQuery, StoreWalletSummary> {
  public readonly queryType = "wallets.getWallet" as const;

  public constructor(private readonly service: WalletsService) {
    super();
  }

  public execute(query: GetWalletQuery): Promise<StoreWalletSummary> {
    return this.service.getStoreWallet(query.principal.userId, query.storeId);
  }
}
