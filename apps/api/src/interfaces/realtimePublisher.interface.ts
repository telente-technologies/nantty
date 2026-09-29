export interface RealtimeEvent {
  readonly type: string;
  readonly [field: string]: unknown;
}

export interface RealtimePublisher {
  publishToUser(userId: string, event: RealtimeEvent): void;
  disconnectUser(userId: string, reason: string): void;
}
