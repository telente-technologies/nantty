import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";

export class GetLiveSessionQuery extends Query<"posts.getLiveSession"> {
  public constructor(
    public readonly sessionId: string,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("posts.getLiveSession");
  }
}
