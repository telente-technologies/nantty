import { QueryHandler } from "@zudojs/cqrs";

import type { TopicRecord } from "../../models/users.model.js";
import type { UsersService } from "../../services/users.service.js";
import type { ListMyTopicsQuery } from "./listMyTopics.query.js";

export class ListMyTopicsHandler extends QueryHandler<ListMyTopicsQuery, readonly TopicRecord[]> {
  public readonly queryType = "users.listMyTopics" as const;

  public constructor(private readonly usersService: UsersService) {
    super();
  }

  public execute(query: ListMyTopicsQuery): Promise<readonly TopicRecord[]> {
    return this.usersService.dependencies.topics.listSelectedTopicsForUser(query.principal.userId);
  }
}
