import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class DeleteCategoryCommand extends Command<"categories.deleteCategory"> {
  public constructor(
    public readonly principal: Principal,
    public readonly categoryId: string,
  ) {
    super("categories.deleteCategory");
  }
}
