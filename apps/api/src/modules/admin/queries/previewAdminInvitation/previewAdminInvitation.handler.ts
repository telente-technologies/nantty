import { QueryHandler } from "@zudojs/cqrs";

import type { AdminInvitationPreview } from "../../services/staffAdministration.service.js";
import type { AdminServices } from "../../services/adminServices.service.js";
import type { PreviewAdminInvitationQuery } from "./previewAdminInvitation.query.js";

export class PreviewAdminInvitationHandler extends QueryHandler<PreviewAdminInvitationQuery, AdminInvitationPreview> {
  public readonly queryType = "admin.previewAdminInvitation" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(query: PreviewAdminInvitationQuery): Promise<AdminInvitationPreview> {
    return this.service.administration.previewInvitation(query.token);
  }
}
