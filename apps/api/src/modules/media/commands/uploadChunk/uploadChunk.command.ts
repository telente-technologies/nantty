import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class UploadChunkCommand extends Command<"media.uploadChunk"> {
  public constructor(
    public readonly principal: Principal,
    public readonly uploadId: string,
    public readonly chunkIndex: number,
    public readonly declaredSha256: string,
    public readonly bytes: Uint8Array,
  ) {
    super("media.uploadChunk");
  }
}
