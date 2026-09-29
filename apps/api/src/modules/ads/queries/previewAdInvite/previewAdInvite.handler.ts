import { QueryHandler } from "@zudojs/cqrs";

import type { AdInvitesService } from "../../services/adInvites.service.js";
import type { PreviewAdInviteQuery } from "./previewAdInvite.query.js";

export class PreviewAdInviteHandler extends QueryHandler<PreviewAdInviteQuery, Awaited<ReturnType<AdInvitesService["previewInvite"]>>> {
  public readonly queryType = "ads.previewAdInvite" as const;

  public constructor(private readonly invitesService: AdInvitesService) {
    super();
  }

  public execute(query: PreviewAdInviteQuery): Promise<Awaited<ReturnType<AdInvitesService["previewInvite"]>>> {
    return this.invitesService.previewInvite(query.token);
  }
}
