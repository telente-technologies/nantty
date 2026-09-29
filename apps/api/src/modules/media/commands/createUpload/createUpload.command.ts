import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { CreateUploadBody } from "../../validators/media.validator.js";

export class CreateUploadCommand extends Command<"media.createUpload"> {
  public constructor(
    public readonly principal: Principal,
    public readonly input: CreateUploadBody,
  ) {
    super("media.createUpload");
  }
}
