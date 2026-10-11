import type { ErrorActionIntent, ErrorIconName, ErrorMotion, ErrorSubject, ErrorTone } from "./errorKinds";

export interface CatalogContext {
  readonly subject?: ErrorSubject;
  readonly code?: string;
  readonly details?: Readonly<Record<string, unknown>> | null;
  readonly retryAfterSeconds?: number;
  readonly permissionLabel?: string;
}

export interface CatalogEntry {
  readonly title: string;
  readonly description: string;
  readonly icon: ErrorIconName;
  readonly tone: ErrorTone;
  readonly motion: ErrorMotion;
  readonly hero?: string;
  readonly primary?: ErrorActionIntent;
  readonly secondary?: ErrorActionIntent;
  readonly live?: "alert" | "status";
}
