import { Query } from "@zudojs/cqrs";

import type { CreatorApplicationStatus } from "../../models/creators.model.js";
import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListCreatorApplicationsQuery extends Query<"creators.listCreatorApplications"> {
  public constructor(
    public readonly status: CreatorApplicationStatus | undefined,
    public readonly page: PageRequest,
  ) {
    super("creators.listCreatorApplications");
  }
}
