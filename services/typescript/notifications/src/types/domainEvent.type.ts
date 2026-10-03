export interface DomainEventEnvelope {
  readonly id: string;
  readonly type: string;
  readonly source: string;
  readonly subject: string;
  readonly schemaVersion: number;
  readonly occurredAt: string;
  readonly data: Readonly<Record<string, unknown>>;
}
