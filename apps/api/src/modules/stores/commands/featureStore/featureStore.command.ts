import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class FeatureStoreCommand extends Command<"stores.featureStore"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly featured: boolean,
  ) {
    super("stores.featureStore");
  }
}
