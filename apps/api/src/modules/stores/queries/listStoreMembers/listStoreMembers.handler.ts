import { QueryHandler } from "@zudojs/cqrs";

import type { StoreMemberRecord } from "../../models/stores.model.js";
import type { StoresService } from "../../services/stores.service.js";
import type { ListStoreMembersQuery } from "./listStoreMembers.query.js";

export class ListStoreMembersHandler extends QueryHandler<ListStoreMembersQuery, readonly StoreMemberRecord[]> {
  public readonly queryType = "stores.listStoreMembers" as const;

  public constructor(private readonly storesService: StoresService) {
    super();
  }

  public async execute(query: ListStoreMembersQuery): Promise<readonly StoreMemberRecord[]> {
    const { stores, storeAccess } = this.storesService.dependencies;
    await storeAccess.assertStoreMember(query.principal.userId, query.storeId);
    return stores.listMembers(query.storeId);
  }
}
