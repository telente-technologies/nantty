import { QueryHandler } from "@zudojs/cqrs";

import type { ConnectionDto, ConnectionsService } from "../../services/connections.service.js";
import type { SearchPeopleQuery } from "./searchPeople.query.js";

export class SearchPeopleHandler extends QueryHandler<SearchPeopleQuery, readonly ConnectionDto[]> {
  public readonly queryType = "follows.searchPeople" as const;

  public constructor(private readonly connections: ConnectionsService) {
    super();
  }

  public execute(query: SearchPeopleQuery): Promise<readonly ConnectionDto[]> {
    return this.connections.searchPeople(query.viewerId, query.term);
  }
}
