import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { PageRequest } from "../../../../types/pagination.type.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetSuggestedClipsQuery extends Query<"feeds.getSuggestedClips"> {
  public constructor(
    public readonly principal: Principal,
    public readonly topic: string | undefined,
    public readonly page: PageRequest,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("feeds.getSuggestedClips");
  }
}
