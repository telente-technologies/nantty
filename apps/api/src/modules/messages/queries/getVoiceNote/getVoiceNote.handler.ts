import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { MediaOriginalFile } from "../../../../interfaces/mediaLibrary.interface.js";
import { isMessageVisibleAt } from "../../models/messages.model.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { GetVoiceNoteQuery } from "./getVoiceNote.query.js";

export class GetVoiceNoteHandler extends QueryHandler<GetVoiceNoteQuery, MediaOriginalFile> {
  public readonly queryType = "messages.getVoiceNote" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(query: GetVoiceNoteQuery): Promise<MediaOriginalFile> {
    const { messages, mediaLibrary, clock } = this.messagesService.dependencies;
    const { conversation } = await this.messagesService.requireConversationAccess(query.conversationId, query.principal.userId);
    const message = await messages.findById(query.messageId);
    const isPlayableVoiceNote = message !== undefined && message.conversationId === conversation.id && message.kind === "voice" && isMessageVisibleAt(message, clock.now());
    if (!isPlayableVoiceNote || message.voiceMediaId === null) throw notFound("Voice note");
    const file = await mediaLibrary.readMediaOriginal(message.voiceMediaId);
    if (file === undefined) throw notFound("Voice note");
    return file;
  }
}
