import { QueryHandler } from "@zudojs/cqrs";

import type { UserSummary } from "../../../../interfaces/userDirectory.interface.js";
import type { SearchService } from "../../services/search.service.js";
import type { SearchUsersQuery } from "./searchUsers.query.js";

export class SearchUsersHandler extends QueryHandler<SearchUsersQuery, readonly UserSummary[]> {
  public readonly queryType = "search.searchUsers" as const;

  public constructor(private readonly searchService: SearchService) {
    super();
  }

  public execute(query: SearchUsersQuery): Promise<readonly UserSummary[]> {
    return this.searchService.userDirectory.searchUsers(query.term, query.limit);
  }
}
