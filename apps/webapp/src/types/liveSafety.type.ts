import type { ID } from "./models.type";

export interface LiveSafetyState {
  readonly state: "paused" | "warning";
  readonly viewerMessage: string;
  readonly heldAt: string | null;
  readonly hostReason?: string;
  readonly category?: string;
  readonly appealable: boolean;
  readonly warningMessage?: string;
  readonly warnedAt?: string;
}

export type LiveReportReason = "child_safety" | "self_harm" | "violence" | "sexual_content" | "hate" | "harassment" | "scam" | "intellectual_property" | "other";

export interface LiveReportContext {
  readonly offsetSeconds?: number;
  readonly frameRef?: string;
  readonly capturedAt?: string;
}

export interface LiveSafetyAppealReceipt {
  readonly status: "received";
  readonly incidentId: ID;
}
