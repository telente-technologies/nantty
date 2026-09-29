import { Command } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { CreatePostBody } from "../../validators/posts.validator.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CreatePostCommand extends Command<"posts.createPost"> {
  public constructor(
    public readonly principal: Principal,
    public readonly input: CreatePostBody,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("posts.createPost");
  }
}
