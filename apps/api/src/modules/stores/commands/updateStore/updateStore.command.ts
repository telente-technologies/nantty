import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { UpdateStoreBody } from "../../validators/stores.validator.js";

export class UpdateStoreCommand extends Command<"stores.updateStore"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly changes: UpdateStoreBody,
  ) {
    super("stores.updateStore");
  }
}
