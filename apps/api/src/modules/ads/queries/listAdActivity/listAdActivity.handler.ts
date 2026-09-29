import { QueryHandler } from "@zudojs/cqrs";

import type { AdInvitesService } from "../../services/adInvites.service.js";
import type { ListAdActivityQuery } from "./listAdActivity.query.js";

export class ListAdActivityHandler extends QueryHandler<ListAdActivityQuery, Awaited<ReturnType<AdInvitesService["listActivity"]>>> {
  public readonly queryType = "ads.listAdActivity" as const;

  public constructor(private readonly invitesService: AdInvitesService) {
    super();
  }

  public execute(query: ListAdActivityQuery): Promise<Awaited<ReturnType<AdInvitesService["listActivity"]>>> {
    return this.invitesService.listActivity(query.principal.userId, query.accountId, query.objectType, query.cursor, query.limit);
  }
}
