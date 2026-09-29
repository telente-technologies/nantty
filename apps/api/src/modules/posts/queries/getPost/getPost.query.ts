import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";

export class GetPostQuery extends Query<"posts.getPost"> {
  public constructor(
    public readonly viewerId: string | undefined,
    public readonly postId: string,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("posts.getPost");
  }
}
