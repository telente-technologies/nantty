import { QueryHandler } from "@zudojs/cqrs";

import type { AdInvitesService } from "../../services/adInvites.service.js";
import type { ListAdInvitesQuery } from "./listAdInvites.query.js";

export class ListAdInvitesHandler extends QueryHandler<ListAdInvitesQuery, Awaited<ReturnType<AdInvitesService["listInvites"]>>> {
  public readonly queryType = "ads.listAdInvites" as const;

  public constructor(private readonly invitesService: AdInvitesService) {
    super();
  }

  public execute(query: ListAdInvitesQuery): Promise<Awaited<ReturnType<AdInvitesService["listInvites"]>>> {
    return this.invitesService.listInvites(query.principal.userId, query.accountId);
  }
}
