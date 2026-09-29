import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { UpdateProductBody } from "../../validators/products.validator.js";

export class UpdateProductCommand extends Command<"products.updateProduct"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly productId: string,
    public readonly changes: UpdateProductBody,
  ) {
    super("products.updateProduct");
  }
}
