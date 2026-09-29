import { CommandHandler } from "@zudojs/cqrs";

import type { AdminModuleServices } from "../../services/adminModule.service.js";
import { notFound } from "../../../../errors/domain.error.js";
import type { RemoveWebAuthnCredentialCommand } from "./removeWebAuthnCredential.command.js";

export class RemoveWebAuthnCredentialHandler extends CommandHandler<RemoveWebAuthnCredentialCommand, void> {
  public readonly commandType = "admin.removeWebAuthnCredential" as const;

  public constructor(private readonly service: AdminModuleServices) {
    super();
  }

  public async execute(command: RemoveWebAuthnCredentialCommand): Promise<void> {
    const { security, audit } = this.service.staff.dependencies;
    if (!(await security.removeWebAuthnCredential(command.principal.userId, command.credentialId))) throw notFound("Security key");
    await audit.record({ actorId: command.principal.userId, action: "admin.webauthn_credential_removed", entityType: "webauthn_credential", entityId: command.credentialId });
  }
}
