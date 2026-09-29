import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { VariantBody } from "../../validators/products.validator.js";

export class AddProductVariantCommand extends Command<"products.addProductVariant"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly productId: string,
    public readonly input: VariantBody,
  ) {
    super("products.addProductVariant");
  }
}
