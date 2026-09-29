import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import { mapPageItems } from "../../../../utils/pagination.util.js";
import { convertAppealToDto, type AppealDto } from "../../dtos/moderation.dto.js";
import type { ModerationService } from "../../services/moderation.service.js";
import type { ListModerationAppealsQuery } from "./listModerationAppeals.query.js";

export class ListModerationAppealsHandler extends QueryHandler<ListModerationAppealsQuery, Page<AppealDto>> {
  public readonly queryType = "moderation.listModerationAppeals" as const;

  public constructor(private readonly moderationService: ModerationService) {
    super();
  }

  public async execute(query: ListModerationAppealsQuery): Promise<Page<AppealDto>> {
    return mapPageItems(await this.moderationService.dependencies.decisions.listAppeals(query.status, query.page), convertAppealToDto);
  }
}
