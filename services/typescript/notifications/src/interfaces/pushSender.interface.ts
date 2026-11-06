import type { PushContent } from "../types/notification.type.js";

export interface PushTokenFailure {
  readonly token: string;
  readonly classification: "retryable" | "permanent";
  readonly code: string;
}

export interface PushSendResult {
  readonly acceptedCount: number;
  readonly failures: readonly PushTokenFailure[];
  /** True only for the log adapter; acceptedCount is not a delivery receipt. */
  readonly simulated?: boolean;
}

export interface PushSender {
  send(tokens: readonly string[], content: PushContent, provider?: PushProvider): Promise<PushSendResult>;
  sendSilent(tokens: readonly string[], data: Readonly<Record<string, unknown>>, provider?: PushProvider): Promise<PushSendResult>;
}

export type PushProvider = "expo" | "fcm";
export type PushProviderMode = "log" | PushProvider | "multi";

export interface RegisteredDeviceToken {
  readonly token: string;
  readonly provider: PushProvider;
}
