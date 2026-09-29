import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { UpdateVariantBody } from "../../validators/products.validator.js";

export class UpdateProductVariantCommand extends Command<"products.updateProductVariant"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly productId: string,
    public readonly variantId: string,
    public readonly changes: UpdateVariantBody,
  ) {
    super("products.updateProductVariant");
  }
}
