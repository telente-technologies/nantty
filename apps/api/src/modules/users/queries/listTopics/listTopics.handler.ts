import { QueryHandler } from "@zudojs/cqrs";

import type { TopicRecord } from "../../models/users.model.js";
import type { UsersService } from "../../services/users.service.js";
import type { ListTopicsQuery } from "./listTopics.query.js";

export class ListTopicsHandler extends QueryHandler<ListTopicsQuery, readonly TopicRecord[]> {
  public readonly queryType = "users.listTopics" as const;

  public constructor(private readonly usersService: UsersService) {
    super();
  }

  public execute(_query: ListTopicsQuery): Promise<readonly TopicRecord[]> {
    return this.usersService.dependencies.topics.listAll();
  }
}
