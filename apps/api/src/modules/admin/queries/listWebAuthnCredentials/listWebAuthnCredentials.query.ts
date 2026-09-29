import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListWebAuthnCredentialsQuery extends Query<"admin.listWebAuthnCredentials"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("admin.listWebAuthnCredentials");
  }
}
