import { Command } from "@zudojs/cqrs";

import type { CreateUploadBody } from "../../validators/media.validator.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CreateUploadUrlCommand extends Command<"media.createUploadUrl"> {
  public constructor(
    public readonly principal: Principal,
    public readonly input: CreateUploadBody,
  ) {
    super("media.createUploadUrl");
  }
}
