import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class UnpublishProductCommand extends Command<"products.unpublishProduct"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly productId: string,
  ) {
    super("products.unpublishProduct");
  }
}
