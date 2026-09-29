import { QueryHandler } from "@zudojs/cqrs";

import type { AdAccountsService } from "../../services/adAccounts.service.js";
import type { ListAdBusinessProfilesQuery } from "./listAdBusinessProfiles.query.js";

export class ListAdBusinessProfilesHandler extends QueryHandler<ListAdBusinessProfilesQuery, Awaited<ReturnType<AdAccountsService["listBusinessProfiles"]>>> {
  public readonly queryType = "ads.listAdBusinessProfiles" as const;

  public constructor(private readonly accountsService: AdAccountsService) {
    super();
  }

  public execute(query: ListAdBusinessProfilesQuery): Promise<Awaited<ReturnType<AdAccountsService["listBusinessProfiles"]>>> {
    return this.accountsService.listBusinessProfiles(query.principal.userId);
  }
}
