export interface ApiValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface ApiErrorBody {
  readonly message: string;
  readonly code: string;
  readonly issues?: readonly ApiValidationIssue[];
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface PagedList<Item> {
  readonly items: readonly Item[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly nextCursor?: string | null;
}

export interface Money {
  readonly amountMinor: number;
  readonly currency: string;
}

export interface PartySummary {
  readonly id: string;
  readonly name: string | null;
  readonly username: string | null;
}

export interface ActorReference {
  readonly id: string;
  readonly name: string;
  readonly kind: "ADMIN" | "USER" | "SYSTEM";
}

export interface AuditTrailEntry {
  readonly id: string;
  readonly action: string;
  readonly actor: ActorReference;
  readonly reason: string | null;
  readonly createdAt: string;
}
