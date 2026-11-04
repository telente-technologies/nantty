export interface EventQueueSnapshot {
  readonly name: string;
  readonly state: string;
  readonly messages: number;
  readonly messagesReady: number;
  readonly messagesUnacknowledged: number;
  readonly consumers: number;
  readonly deadLetter: boolean;
}

export interface EventQueueSummary {
  readonly queueCount: number;
  readonly deadLetterQueueCount: number;
  readonly readyMessages: number;
  readonly unacknowledgedMessages: number;
  readonly deadLetterReadyMessages: number;
}

export interface EventOperationsSnapshot {
  readonly data: readonly EventQueueSnapshot[];
  readonly summary: EventQueueSummary;
  readonly consumers: {
    readonly status: "available" | "unavailable" | "unsupported";
    readonly registrations: readonly EventConsumerRegistration[];
  };
}

export interface EventConsumerRegistration {
  readonly queueName: string;
  readonly ackRequired: boolean;
  readonly prefetchCount: number;
  readonly exclusive: boolean;
}
