import { QueryHandler } from "@zudojs/cqrs";

import { convertDecisionToDto, type DecisionDto } from "../../dtos/moderation.dto.js";
import type { ModerationService } from "../../services/moderation.service.js";
import type { ListMyModerationDecisionsQuery } from "./listMyModerationDecisions.query.js";

const MY_DECISIONS_LIMIT = 100;

export class ListMyModerationDecisionsHandler extends QueryHandler<ListMyModerationDecisionsQuery, readonly DecisionDto[]> {
  public readonly queryType = "moderation.listMyModerationDecisions" as const;

  public constructor(private readonly moderationService: ModerationService) {
    super();
  }

  public async execute(query: ListMyModerationDecisionsQuery): Promise<readonly DecisionDto[]> {
    const { decisions } = this.moderationService.dependencies;
    const affecting = (await decisions.listDecisionsAffectingUser(query.principal.userId, MY_DECISIONS_LIMIT)).filter((decision) => decision.action !== "dismiss");
    const appeals = await decisions.listAppealsForDecisions(affecting.map((decision) => decision.id));
    return affecting.map((decision) => convertDecisionToDto(decision, appeals.find((appeal) => appeal.decisionId === decision.id)));
  }
}
