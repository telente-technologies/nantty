import { QueryHandler } from "@zudojs/cqrs";

import type { AdminModuleServices } from "../../services/adminModule.service.js";
import { convertWebAuthnCredentialToDto } from "../../dtos/admin.dto.js";
import type { ListWebAuthnCredentialsQuery } from "./listWebAuthnCredentials.query.js";

export class ListWebAuthnCredentialsHandler extends QueryHandler<ListWebAuthnCredentialsQuery, readonly ReturnType<typeof convertWebAuthnCredentialToDto>[]> {
  public readonly queryType = "admin.listWebAuthnCredentials" as const;

  public constructor(private readonly service: AdminModuleServices) {
    super();
  }

  public async execute(query: ListWebAuthnCredentialsQuery): Promise<readonly ReturnType<typeof convertWebAuthnCredentialToDto>[]> {
    const credentials = await this.service.staff.dependencies.security.listWebAuthnCredentials(query.principal.userId);
    return credentials.map(convertWebAuthnCredentialToDto);
  }
}
