import { Command } from "@zudojs/cqrs";

import type { CreateCategoryBody } from "../../validators/categories.validator.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CreateCategoryCommand extends Command<"categories.createCategory"> {
  public constructor(
    public readonly principal: Principal,
    public readonly input: CreateCategoryBody,
  ) {
    super("categories.createCategory");
  }
}
