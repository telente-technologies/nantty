import { QueryHandler } from "@zudojs/cqrs";

import type { AdAccountsService } from "../../services/adAccounts.service.js";
import type { GetAdEntitlementsQuery } from "./getAdEntitlements.query.js";

export class GetAdEntitlementsHandler extends QueryHandler<GetAdEntitlementsQuery, Awaited<ReturnType<AdAccountsService["readEntitlements"]>>> {
  public readonly queryType = "ads.getAdEntitlements" as const;

  public constructor(private readonly accountsService: AdAccountsService) {
    super();
  }

  public execute(query: GetAdEntitlementsQuery): Promise<Awaited<ReturnType<AdAccountsService["readEntitlements"]>>> {
    return this.accountsService.readEntitlements(query.principal.userId, query.accountId);
  }
}
