import { Query } from "@zudojs/cqrs";

import type { AppealStatus } from "../../models/moderation.model.js";
import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListModerationAppealsQuery extends Query<"moderation.listModerationAppeals"> {
  public constructor(
    public readonly status: AppealStatus | undefined,
    public readonly page: PageRequest,
  ) {
    super("moderation.listModerationAppeals");
  }
}
