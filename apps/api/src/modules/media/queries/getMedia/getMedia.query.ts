import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetMediaQuery extends Query<"media.getMedia"> {
  public constructor(
    public readonly viewer: Principal | undefined,
    public readonly mediaId: string,
  ) {
    super("media.getMedia");
  }
}
