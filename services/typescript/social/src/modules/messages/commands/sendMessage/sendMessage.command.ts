import type { MentionEntity } from "../../../mentions/models/mention.model.js";
import type { OutgoingMessageInput } from "../../services/messageValidation.service.js";

export interface SendMessageCommand {
  readonly senderId: string;
  readonly conversationId: string;
  readonly idempotencyKey: string | undefined;
  readonly message: OutgoingMessageInput;
  readonly mentions: readonly MentionEntity[] | undefined;
}
