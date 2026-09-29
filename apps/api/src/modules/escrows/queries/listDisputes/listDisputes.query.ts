import { Query } from "@zudojs/cqrs";

import type { DisputeStatus } from "../../models/escrows.model.js";
import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListDisputesQuery extends Query<"escrows.listDisputes"> {
  public constructor(
    public readonly status: DisputeStatus | undefined,
    public readonly page: PageRequest,
  ) {
    super("escrows.listDisputes");
  }
}
