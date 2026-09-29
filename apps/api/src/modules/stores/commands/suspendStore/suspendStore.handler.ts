import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import { StoreStatusChangedEvent } from "../../events/storeStatusChanged.event.js";
import type { StoreRecord } from "../../models/stores.model.js";
import type { StoresService } from "../../services/stores.service.js";
import type { SuspendStoreCommand } from "./suspendStore.command.js";

export class SuspendStoreHandler extends CommandHandler<SuspendStoreCommand, StoreRecord> {
  public readonly commandType = "stores.suspendStore" as const;

  public constructor(private readonly storesService: StoresService) {
    super();
  }

  public async execute(command: SuspendStoreCommand): Promise<StoreRecord> {
    const { stores, audit, events } = this.storesService.dependencies;
    const updated = await stores.updateStatus(command.storeId, command.status);
    if (updated === undefined) throw notFound("Store");
    await audit.record({
      actorId: command.principal.userId,
      action: command.status === "suspended" ? "stores.suspended" : "stores.reinstated",
      entityType: "store",
      entityId: command.storeId,
      metadata: { reason: command.reason ?? null },
    });
    await publishEvent(events, StoreStatusChangedEvent, { storeId: command.storeId, status: command.status });
    return updated;
  }
}
