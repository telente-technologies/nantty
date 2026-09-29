import { Command } from "@zudojs/cqrs";

import type { CreateProductBody } from "../../validators/products.validator.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CreateProductCommand extends Command<"products.createProduct"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly input: CreateProductBody,
  ) {
    super("products.createProduct");
  }
}
