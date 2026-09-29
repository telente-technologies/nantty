import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { ConnectionDto, ConnectionsService } from "../../services/connections.service.js";
import type { ListConnectionsQuery } from "./listConnections.query.js";

export class ListConnectionsHandler extends QueryHandler<ListConnectionsQuery, Page<ConnectionDto>> {
  public readonly queryType = "follows.listConnections" as const;

  public constructor(private readonly connections: ConnectionsService) {
    super();
  }

  public execute(query: ListConnectionsQuery): Promise<Page<ConnectionDto>> {
    return this.connections.listConnections(query.principal.userId, query.userId, query.tab, query.page);
  }
}
