import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetUploadQuery extends Query<"media.getUpload"> {
  public constructor(
    public readonly principal: Principal,
    public readonly uploadId: string,
  ) {
    super("media.getUpload");
  }
}
