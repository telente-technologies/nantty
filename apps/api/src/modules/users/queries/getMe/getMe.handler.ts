import { QueryHandler } from "@zudojs/cqrs";

import type { UserRecord } from "../../models/users.model.js";
import type { UsersService } from "../../services/users.service.js";
import type { GetMeQuery } from "./getMe.query.js";

export class GetMeHandler extends QueryHandler<GetMeQuery, UserRecord> {
  public readonly queryType = "users.getMe" as const;

  public constructor(private readonly usersService: UsersService) {
    super();
  }

  public execute(query: GetMeQuery): Promise<UserRecord> {
    return this.usersService.findActiveUserOrThrow(query.principal.userId);
  }
}
