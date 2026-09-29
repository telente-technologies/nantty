import { CommandHandler } from "@zudojs/cqrs";

import type { StoreRecord } from "../../models/stores.model.js";
import type { StoresService } from "../../services/stores.service.js";
import type { CreateStoreCommand } from "./createStore.command.js";

export class CreateStoreHandler extends CommandHandler<CreateStoreCommand, StoreRecord> {
  public readonly commandType = "stores.createStore" as const;

  public constructor(private readonly storesService: StoresService) {
    super();
  }

  public execute(command: CreateStoreCommand): Promise<StoreRecord> {
    return this.storesService.createStoreOwnedBy(command.principal.userId, command.input, command.currency);
  }
}
