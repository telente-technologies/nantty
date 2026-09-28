import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetSessionQuery extends Query<"auth.get-session"> {
  public constructor(
    public readonly principal: Principal,
    public readonly sessionId: string,
  ) {
    super("auth.get-session");
  }
}
