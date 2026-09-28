import { QueryHandler } from "@zudojs/cqrs";

import type { AuthService } from "../../services/auth.service.js";
import { normalizeUsername } from "../../services/contact.service.js";
import type { CheckUsernameAvailabilityQuery } from "./checkUsernameAvailability.query.js";

export class CheckUsernameAvailabilityHandler extends QueryHandler<CheckUsernameAvailabilityQuery, boolean> {
  public readonly queryType = "auth.checkUsernameAvailability" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public async execute(query: CheckUsernameAvailabilityQuery): Promise<boolean> {
    return (await this.auth.dependencies.users.findByUsername(normalizeUsername(query.username))) === undefined;
  }
}
