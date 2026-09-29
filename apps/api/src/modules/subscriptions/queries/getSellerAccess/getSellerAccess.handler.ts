import { QueryHandler } from "@zudojs/cqrs";

import type { SellerAccessService } from "../../services/sellerAccess.service.js";
import type { SellerAccessSummary } from "../../services/sellerAccess.service.js";
import type { GetSellerAccessQuery } from "./getSellerAccess.query.js";

export class GetSellerAccessHandler extends QueryHandler<GetSellerAccessQuery, SellerAccessSummary> {
  public readonly queryType = "subscriptions.getSellerAccess" as const;

  public constructor(private readonly service: SellerAccessService) {
    super();
  }

  public execute(query: GetSellerAccessQuery): Promise<SellerAccessSummary> {
    return this.service.buildAccessSummary(query.principal, query.storeId);
  }
}
