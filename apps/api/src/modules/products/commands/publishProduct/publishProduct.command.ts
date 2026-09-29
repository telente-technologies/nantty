import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class PublishProductCommand extends Command<"products.publishProduct"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly productId: string,
  ) {
    super("products.publishProduct");
  }
}
