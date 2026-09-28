import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { SessionRecord } from "../../models/auth.model.js";
import type { AuthService } from "../../services/auth.service.js";
import type { GetSessionQuery } from "./getSession.query.js";

export class GetSessionHandler extends QueryHandler<GetSessionQuery, SessionRecord> {
  public readonly queryType = "auth.getSession" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public async execute(query: GetSessionQuery): Promise<SessionRecord> {
    const session = await this.auth.dependencies.sessions.findById(query.sessionId);
    if (session === undefined || session.userId !== query.principal.userId || session.revokedAt !== null) throw notFound("Session");
    return session;
  }
}
