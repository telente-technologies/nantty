import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { ProductEngagementKind } from "../../repositories/productEngagement.repository.js";

export class ChangeProductEngagementCommand extends Command<"products.changeProductEngagement"> {
  public constructor(
    public readonly principal: Principal,
    public readonly productId: string,
    public readonly kind: ProductEngagementKind,
    public readonly engaged: boolean,
  ) {
    super("products.changeProductEngagement");
  }
}
