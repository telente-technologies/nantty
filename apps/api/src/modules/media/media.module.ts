import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { CompleteUploadHandler } from "./commands/completeUpload/completeUpload.handler.js";
import { CreateUploadHandler } from "./commands/createUpload/createUpload.handler.js";
import { DeleteMediaHandler } from "./commands/deleteMedia/deleteMedia.handler.js";
import { UploadChunkHandler } from "./commands/uploadChunk/uploadChunk.handler.js";
import { GetMediaHandler } from "./queries/getMedia/getMedia.handler.js";
import { GetOriginalFileHandler } from "./queries/getOriginalFile/getOriginalFile.handler.js";
import { GetPublicFileHandler } from "./queries/getPublicFile/getPublicFile.handler.js";
import { GetUploadHandler } from "./queries/getUpload/getUpload.handler.js";
import type { MediaService } from "./services/media.service.js";
import type { MediaAssemblyService } from "./services/mediaAssembly.service.js";

export class MediaModule extends BaseModule {
  public readonly id = "media";
  public readonly name = "media";

  public constructor() {
    super({ version: "0.2.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("media module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("media module stopped");
  }
}

export function registerMediaCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, mediaService: MediaService, assembly: MediaAssemblyService): void {
  registerCommandHandlers(commands, [
    new CreateUploadHandler(mediaService),
    new UploadChunkHandler(mediaService),
    new CompleteUploadHandler(mediaService, assembly),
    new DeleteMediaHandler(mediaService),
  ]);
  registerQueryHandlers(queries, [
    new GetUploadHandler(mediaService),
    new GetMediaHandler(mediaService),
    new GetPublicFileHandler(mediaService),
    new GetOriginalFileHandler(mediaService),
  ]);
}
