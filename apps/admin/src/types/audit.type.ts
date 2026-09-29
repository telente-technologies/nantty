export type AuditJsonValue = string | number | boolean | null | readonly AuditJsonValue[] | { readonly [key: string]: AuditJsonValue };

export interface AuditActor {
  readonly id: string;
  readonly name: string;
  readonly kind: "ADMIN" | "USER" | "SYSTEM";
  readonly role: string | null;
}

export interface AuditTarget {
  readonly type: string;
  readonly id: string;
  readonly label: string;
}

export interface AuditLogEntry {
  readonly id: string;
  readonly occurredAt: string;
  readonly actor: AuditActor;
  readonly action: string;
  readonly area: string;
  readonly target: AuditTarget;
  readonly reason: string | null;
  readonly before: AuditJsonValue | null;
  readonly after: AuditJsonValue | null;
  readonly ipAddress: string | null;
  readonly requestId: string;
  readonly stepUpVerified: boolean;
}
