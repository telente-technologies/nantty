import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CompleteUploadCommand extends Command<"media.completeUpload"> {
  public constructor(
    public readonly principal: Principal,
    public readonly uploadId: string,
  ) {
    super("media.completeUpload");
  }
}
