import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";
import type { VerificationFilter } from "../../models/verifications.model.js";

export class ListVerificationsQuery extends Query<"verifications.listVerifications"> {
  public constructor(
    public readonly filter: VerificationFilter,
    public readonly page: PageRequest,
  ) {
    super("verifications.listVerifications");
  }
}
