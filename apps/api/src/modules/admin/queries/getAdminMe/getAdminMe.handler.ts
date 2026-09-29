import { QueryHandler } from "@zudojs/cqrs";

import type { AdminModuleServices } from "../../services/adminModule.service.js";
import { convertStaffAccountToDto, type AdminMeDto } from "../../dtos/admin.dto.js";
import type { GetAdminMeQuery } from "./getAdminMe.query.js";

export class GetAdminMeHandler extends QueryHandler<GetAdminMeQuery, AdminMeDto> {
  public readonly queryType = "admin.getAdminMe" as const;

  public constructor(private readonly service: AdminModuleServices) {
    super();
  }

  public async execute(query: GetAdminMeQuery): Promise<AdminMeDto> {
    const { staff } = this.service;
    const { account, session } = await staff.findVerifiedStaffSessionOrThrow(query.principal);
    const [user, credentials] = await Promise.all([staff.dependencies.users.findById(account.userId), staff.dependencies.security.listWebAuthnCredentials(account.userId)]);
    return { ...convertStaffAccountToDto(account, user), sessionId: session.sessionId, stepUpValidUntil: staff.stepUpValidUntil(session).toISOString(), webAuthnCredentials: credentials.length };
  }
}
