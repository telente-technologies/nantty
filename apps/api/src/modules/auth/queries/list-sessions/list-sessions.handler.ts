import { QueryHandler } from "@zudojs/cqrs";

import type { SessionRecord } from "../../models/auth.model.js";
import type { AuthService } from "../../services/auth.service.js";
import type { ListSessionsQuery } from "./list-sessions.query.js";

export class ListSessionsHandler extends QueryHandler<ListSessionsQuery, readonly SessionRecord[]> {
  public readonly queryType = "auth.list-sessions" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public execute(query: ListSessionsQuery): Promise<readonly SessionRecord[]> {
    const { sessions, clock } = this.auth.dependencies;
    return sessions.listActiveForUser(query.principal.userId, clock.now());
  }
}
