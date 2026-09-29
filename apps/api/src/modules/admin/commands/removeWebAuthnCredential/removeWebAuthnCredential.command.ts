import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RemoveWebAuthnCredentialCommand extends Command<"admin.removeWebAuthnCredential"> {
  public constructor(
    public readonly principal: Principal,
    public readonly credentialId: string,
  ) {
    super("admin.removeWebAuthnCredential");
  }
}
