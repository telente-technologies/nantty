import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import { mapPageItems } from "../../../../utils/pagination.util.js";
import { convertCaseToDto, type ModerationCaseDto } from "../../dtos/moderation.dto.js";
import type { ModerationService } from "../../services/moderation.service.js";
import type { ListModerationCasesQuery } from "./listModerationCases.query.js";

export class ListModerationCasesHandler extends QueryHandler<ListModerationCasesQuery, Page<ModerationCaseDto>> {
  public readonly queryType = "moderation.listModerationCases" as const;

  public constructor(private readonly moderationService: ModerationService) {
    super();
  }

  public async execute(query: ListModerationCasesQuery): Promise<Page<ModerationCaseDto>> {
    return mapPageItems(await this.moderationService.dependencies.cases.listCases(query.status, query.page), convertCaseToDto);
  }
}
