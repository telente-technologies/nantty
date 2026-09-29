import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { ConfirmUploadHandler } from "./commands/confirmUpload/confirmUpload.handler.js";
import { CreateUploadUrlHandler } from "./commands/createUploadUrl/createUploadUrl.handler.js";
import { DeleteMediaHandler } from "./commands/deleteMedia/deleteMedia.handler.js";
import { GetMediaHandler } from "./queries/getMedia/getMedia.handler.js";
import type { MediaService } from "./services/media.service.js";

export class MediaModule extends BaseModule {
  public readonly id = "media";
  public readonly name = "media";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("media module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("media module stopped");
  }
}

export function registerMediaCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, mediaService: MediaService): void {
  registerCommandHandlers(commands, [new CreateUploadUrlHandler(mediaService), new ConfirmUploadHandler(mediaService), new DeleteMediaHandler(mediaService)]);
  registerQueryHandlers(queries, [new GetMediaHandler(mediaService)]);
}
