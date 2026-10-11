import type { PushContent } from "../types/notification.type.js";

export interface PushSender {
  send(tokens: readonly string[], content: PushContent): Promise<void>;
  sendSilent(tokens: readonly string[], data: Readonly<Record<string, unknown>>): Promise<void>;
}
