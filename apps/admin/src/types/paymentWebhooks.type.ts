export interface DeadLetteredWebhook {
  readonly id: string;
  readonly provider: string;
  readonly eventType: string;
  readonly eventKey: string;
  readonly reference: string;
  readonly attempts: number;
  readonly lastError: string;
  readonly createdAt: string;
  readonly deadLetteredAt: string | null;
  readonly processedAt: string | null;
  readonly payload?: unknown;
}

export interface DeadLetteredWebhookList {
  readonly items: readonly DeadLetteredWebhook[];
}
