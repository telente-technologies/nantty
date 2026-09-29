import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetOriginalFileQuery extends Query<"media.getOriginalFile"> {
  public constructor(
    public readonly principal: Principal,
    public readonly mediaId: string,
  ) {
    super("media.getOriginalFile");
  }
}
