import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListSellerApplicationsQuery extends Query<"stores.listSellerApplications"> {
  public constructor(
    public readonly status: "pending" | "approved" | "rejected" | undefined,
    public readonly page: PageRequest,
  ) {
    super("stores.listSellerApplications");
  }
}
