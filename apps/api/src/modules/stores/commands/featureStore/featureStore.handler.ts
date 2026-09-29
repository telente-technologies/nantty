import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { StoreRecord } from "../../models/stores.model.js";
import type { StoresService } from "../../services/stores.service.js";
import type { FeatureStoreCommand } from "./featureStore.command.js";

export class FeatureStoreHandler extends CommandHandler<FeatureStoreCommand, StoreRecord> {
  public readonly commandType = "stores.featureStore" as const;

  public constructor(private readonly storesService: StoresService) {
    super();
  }

  public async execute(command: FeatureStoreCommand): Promise<StoreRecord> {
    const { stores, audit } = this.storesService.dependencies;
    const updated = await stores.update(command.storeId, { featured: command.featured });
    if (updated === undefined) throw notFound("Store");
    await audit.record({
      actorId: command.principal.userId,
      action: command.featured ? "stores.featured" : "stores.unfeatured",
      entityType: "store",
      entityId: command.storeId,
    });
    return updated;
  }
}
