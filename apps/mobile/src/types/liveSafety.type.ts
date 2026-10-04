import type { ID } from "./models.type";

export type LiveSafetyStateName = "paused" | "warning";

export interface LiveSafetyState {
  readonly state: LiveSafetyStateName;
  readonly viewerMessage: string;
  readonly heldAt: string | null;
  readonly hostReason?: string;
  readonly category?: string;
  readonly appealable: boolean;
  readonly warningMessage?: string;
  readonly warnedAt?: string;
}

export interface LiveSafetyViewerRealtimeEvent {
  readonly type: "live.safety.paused" | "live.safety.resumed";
  readonly liveId: ID;
  readonly state: "paused" | "live";
  readonly message: string;
  readonly at: string;
}

export interface LiveSafetyHostNoticeRealtimeEvent {
  readonly type: "live.safety.hostNotice";
  readonly liveId: ID;
  readonly hostId: ID;
  readonly kind: "hold" | "released" | "warning" | "ended";
  readonly category?: string;
  readonly message: string;
  readonly incidentId?: ID;
  readonly appealable: boolean;
  readonly at: string;
}

export type LiveSafetyRealtimeEvent = LiveSafetyViewerRealtimeEvent | LiveSafetyHostNoticeRealtimeEvent;

export interface LiveSafetyAppealReceipt {
  readonly status: "received";
  readonly incidentId: ID;
}
