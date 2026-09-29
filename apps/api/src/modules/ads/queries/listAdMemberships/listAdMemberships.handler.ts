import { QueryHandler } from "@zudojs/cqrs";

import type { AdAccountsService } from "../../services/adAccounts.service.js";
import type { ListAdMembershipsQuery } from "./listAdMemberships.query.js";

export class ListAdMembershipsHandler extends QueryHandler<ListAdMembershipsQuery, Awaited<ReturnType<AdAccountsService["listMemberships"]>>> {
  public readonly queryType = "ads.listAdMemberships" as const;

  public constructor(private readonly accountsService: AdAccountsService) {
    super();
  }

  public execute(query: ListAdMembershipsQuery): Promise<Awaited<ReturnType<AdAccountsService["listMemberships"]>>> {
    return this.accountsService.listMemberships(query.principal.userId);
  }
}
