import { QueryHandler } from "@zudojs/cqrs";

import type { AdAccountsService } from "../../services/adAccounts.service.js";
import type { GetAdAccountQuery } from "./getAdAccount.query.js";

export class GetAdAccountHandler extends QueryHandler<GetAdAccountQuery, Awaited<ReturnType<AdAccountsService["getAccount"]>>> {
  public readonly queryType = "ads.getAdAccount" as const;

  public constructor(private readonly accountsService: AdAccountsService) {
    super();
  }

  public execute(query: GetAdAccountQuery): Promise<Awaited<ReturnType<AdAccountsService["getAccount"]>>> {
    return this.accountsService.getAccount(query.principal.userId, query.accountId);
  }
}
