import { QueryHandler } from "@zudojs/cqrs";

import type { AdAccountsService } from "../../services/adAccounts.service.js";
import type { ListAdAccountsQuery } from "./listAdAccounts.query.js";

export class ListAdAccountsHandler extends QueryHandler<ListAdAccountsQuery, Awaited<ReturnType<AdAccountsService["listAccounts"]>>> {
  public readonly queryType = "ads.listAdAccounts" as const;

  public constructor(private readonly accountsService: AdAccountsService) {
    super();
  }

  public execute(query: ListAdAccountsQuery): Promise<Awaited<ReturnType<AdAccountsService["listAccounts"]>>> {
    return this.accountsService.listAccounts(query.principal.userId);
  }
}
