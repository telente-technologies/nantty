import { Command } from "@zudojs/cqrs";

export class ConfirmUploadCommand extends Command<"media.confirmUpload"> {
  public constructor(
    public readonly mediaId: string,
    public readonly expiresAtSeconds: number,
    public readonly signature: string,
    public readonly declaredContentType: string | undefined,
    public readonly bytes: Uint8Array,
  ) {
    super("media.confirmUpload");
  }
}
