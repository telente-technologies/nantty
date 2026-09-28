import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { UpdateCategoryBody } from "../../validators/categories.validator.js";

export class UpdateCategoryCommand extends Command<"categories.updateCategory"> {
  public constructor(
    public readonly principal: Principal,
    public readonly categoryId: string,
    public readonly changes: UpdateCategoryBody,
  ) {
    super("categories.updateCategory");
  }
}
