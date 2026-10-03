import type { SharedContentReference } from "../../models/message.model.js";

export interface ShareToChatsCommand {
  readonly senderId: string;
  readonly conversationIds: readonly string[];
  readonly reference: SharedContentReference;
  readonly encryptions: readonly { readonly conversationId: string; readonly deviceId: string; readonly ciphertext: string }[];
}
