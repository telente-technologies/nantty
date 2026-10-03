import type { PushContent } from "../types/notification.type.js";

export interface PushSender {
  send(tokens: readonly string[], content: PushContent): Promise<void>;
}
