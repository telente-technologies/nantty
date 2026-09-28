export interface AuditEntry {
  readonly actorId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly ip?: string;
}

export interface AuditRecorder {
  record(entry: AuditEntry): Promise<void>;
}
