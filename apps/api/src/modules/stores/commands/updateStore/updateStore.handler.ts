import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { StoreRecord } from "../../models/stores.model.js";
import type { StoresService } from "../../services/stores.service.js";
import type { UpdateStoreCommand } from "./updateStore.command.js";

export class UpdateStoreHandler extends CommandHandler<UpdateStoreCommand, StoreRecord> {
  public readonly commandType = "stores.updateStore" as const;

  public constructor(private readonly storesService: StoresService) {
    super();
  }

  public async execute(command: UpdateStoreCommand): Promise<StoreRecord> {
    const { stores, storeAccess } = this.storesService.dependencies;
    await storeAccess.assertStoreManager(command.principal.userId, command.storeId);
    await this.storesService.assertStoreCurrencyCanChange(await this.storesService.findStoreOrThrow(command.storeId), command.changes.currency);
    const { name, ...rest } = command.changes;
    const updated = await stores.update(command.storeId, { ...rest, ...(name === undefined ? {} : { name: name.trim() }) });
    if (updated === undefined) throw notFound("Store");
    return updated;
  }
}
