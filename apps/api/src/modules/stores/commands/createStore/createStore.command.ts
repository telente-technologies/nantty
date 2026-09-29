import { Command } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { CreateStoreBody } from "../../validators/stores.validator.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CreateStoreCommand extends Command<"stores.createStore"> {
  public constructor(
    public readonly principal: Principal,
    public readonly input: CreateStoreBody,
    public readonly currency: CurrencyCode,
  ) {
    super("stores.createStore");
  }
}
