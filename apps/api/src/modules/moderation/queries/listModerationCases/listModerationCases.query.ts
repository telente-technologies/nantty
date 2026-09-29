import { Query } from "@zudojs/cqrs";

import type { CaseStatus } from "../../models/moderation.model.js";
import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListModerationCasesQuery extends Query<"moderation.listModerationCases"> {
  public constructor(
    public readonly status: CaseStatus | undefined,
    public readonly page: PageRequest,
  ) {
    super("moderation.listModerationCases");
  }
}
