import { CommandHandler } from "@zudojs/cqrs";

import type { UploadCompletedDto } from "../../dtos/media.dto.js";
import type { MediaService } from "../../services/media.service.js";
import type { MediaAssemblyService } from "../../services/mediaAssembly.service.js";
import type { CompleteUploadCommand } from "./completeUpload.command.js";

export class CompleteUploadHandler extends CommandHandler<CompleteUploadCommand, UploadCompletedDto> {
  public readonly commandType = "media.completeUpload" as const;

  public constructor(
    private readonly mediaService: MediaService,
    private readonly assembly: MediaAssemblyService,
  ) {
    super();
  }

  public async execute(command: CompleteUploadCommand): Promise<UploadCompletedDto> {
    const upload = await this.mediaService.findOwnedUploadOrThrow(command.uploadId, command.principal.userId);
    return this.assembly.completeUpload(upload);
  }
}
