import type { ID, ISODate } from "./index";

export type IngestProtocol = "rtmp" | "whip";

export type IngressStatus = "inactive" | "buffering" | "publishing" | "error" | "complete" | "unknown";

export interface IngressHealth {
  readonly protocol: IngestProtocol;
  readonly status: IngressStatus;
  readonly error: string | null;
  readonly videoBitrateKbps: number | null;
  readonly audioBitrateKbps: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly framerate: number | null;
}

export interface StreamHealth {
  readonly liveId: ID;
  readonly state: "idle" | "connecting" | "live" | "ended";
  readonly viewers: number;
  readonly peakViewers: number;
  readonly startedAt: ISODate | null;
  readonly ingress: IngressHealth | null;
  readonly checkedAt: ISODate;
}

export type CommentAudience = "everyone" | "followers" | "subscribers";

export interface ModeratorSummary {
  readonly id: ID;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
}

export interface HostDefaults {
  readonly commentsEnabled: boolean;
  readonly commentAudience: CommentAudience;
  readonly slowModeSeconds: number;
  readonly blockedWords: readonly string[];
  readonly moderators: readonly ModeratorSummary[];
  readonly updatedAt: ISODate | null;
}

export interface HostDefaultsInput {
  readonly commentsEnabled: boolean;
  readonly commentAudience: CommentAudience;
  readonly slowModeSeconds: number;
  readonly blockedWords: readonly string[];
  readonly moderatorIds: readonly ID[];
}

export interface LiveRecording {
  readonly id: ID;
  readonly liveId: ID;
  readonly state: "recording" | "completed" | "failed";
  readonly durationSeconds: number;
  readonly sizeBytes: number;
  readonly createdAt: ISODate;
  readonly completedAt: ISODate | null;
  readonly playbackUrl: string | null;
}

export interface ScheduleLiveInput {
  readonly title: string;
  readonly category: string;
  readonly scheduledAt: ISODate;
  readonly storeId: ID | null;
}

export interface EditLiveInput {
  readonly title?: string;
  readonly category?: string;
  readonly scheduledAt?: ISODate | null;
}

export interface RoomSettings {
  readonly liveId: ID;
  readonly commentsEnabled: boolean;
  readonly commentAudience?: CommentAudience;
  readonly slowModeSeconds: number;
  readonly blockedWords?: readonly string[];
  readonly myRole: string;
  readonly recordEnabled?: boolean;
}

export interface RoomSettingsInput {
  readonly commentsEnabled: boolean;
  readonly commentAudience: CommentAudience;
  readonly slowModeSeconds: number;
  readonly blockedWords: readonly string[];
}
