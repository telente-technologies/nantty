import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { normalizeUsername } from "../../../auth/services/contact.service.js";
import type { UserRecord } from "../../models/users.model.js";
import type { UsersService } from "../../services/users.service.js";
import type { GetUserQuery } from "./getUser.query.js";

export class GetUserHandler extends QueryHandler<GetUserQuery, UserRecord> {
  public readonly queryType = "users.getUser" as const;

  public constructor(private readonly usersService: UsersService) {
    super();
  }

  public async execute(query: GetUserQuery): Promise<UserRecord> {
    const { users } = this.usersService.dependencies;
    const user = "id" in query.lookup ? await users.findById(query.lookup.id) : await users.findByUsername(normalizeUsername(query.lookup.username));
    if (user === undefined || user.status !== "active") throw notFound("User");
    return user;
  }
}
