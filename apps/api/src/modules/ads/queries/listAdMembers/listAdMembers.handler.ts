import { QueryHandler } from "@zudojs/cqrs";

import type { AdAccountsService } from "../../services/adAccounts.service.js";
import type { ListAdMembersQuery } from "./listAdMembers.query.js";

export class ListAdMembersHandler extends QueryHandler<ListAdMembersQuery, Awaited<ReturnType<AdAccountsService["listMembers"]>>> {
  public readonly queryType = "ads.listAdMembers" as const;

  public constructor(private readonly accountsService: AdAccountsService) {
    super();
  }

  public execute(query: ListAdMembersQuery): Promise<Awaited<ReturnType<AdAccountsService["listMembers"]>>> {
    return this.accountsService.listMembers(query.principal.userId, query.accountId);
  }
}
