export type AuditActorKind = "ADMIN" | "USER" | "SYSTEM";

export interface AuditEntry {
  readonly actorId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly ip?: string;
  readonly actorKind?: AuditActorKind;
  readonly actorName?: string;
  readonly actorRole?: string;
  readonly area?: string;
  readonly targetLabel?: string;
  readonly reason?: string;
  readonly requestId?: string;
  readonly stepUpVerified?: boolean;
}

export interface AuditRecorder {
  record(entry: AuditEntry): Promise<void>;
}
