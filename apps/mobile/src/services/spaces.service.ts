import { api, generateIdempotencyKey } from "./core/apiClient.service";

export type SpaceState = "live" | "scheduled" | "ended" | "cancelled";
export type SpaceRole = "host" | "moderator" | "speaker" | "listener";

export interface SpacePerson {
  readonly id: string;
  readonly name: string;
  readonly username?: string | null;
  readonly avatarUrl?: string | null;
  readonly role: SpaceRole;
  readonly muted?: boolean;
}

export interface SpaceSummary {
  readonly id: string;
  readonly title: string;
  readonly description?: string | null;
  readonly state: SpaceState;
  readonly scheduledAt?: string | null;
  readonly startedAt?: string | null;
  readonly listenerCount: number;
  readonly host: SpacePerson;
}

export interface SpaceDetails extends SpaceSummary {
  readonly speakers: readonly SpacePerson[];
  readonly viewerRole?: SpaceRole | null;
  readonly viewerJoined?: boolean;
  readonly viewerReminder?: boolean;
  readonly speakerRequestState?: "pending" | "approved" | "declined" | "cancelled" | null;
  readonly pendingSpeakerRequests?: readonly { readonly id: string; readonly user: SpacePerson }[];
}

export interface SpacePage {
  readonly data: readonly SpaceSummary[];
  readonly nextCursor: string | null;
}

export interface CreateSpaceInput {
  readonly title: string;
  readonly description?: string;
  readonly audiencePolicy: "public" | "followers";
  readonly scheduledAt?: string;
}

const pathFor = (spaceId: string) => `/api/v1/spaces/${encodeURIComponent(spaceId)}`;

export const spacesService = {
  list: (cursor?: string) => api.getPage<SpaceSummary>("/api/v1/spaces", { state: "live,upcoming", cursor, limit: 30 }),
  create: (input: CreateSpaceInput) => api.post<SpaceDetails>("/api/v1/spaces", input, { idempotencyKey: generateIdempotencyKey() }),
  detail: (spaceId: string) => api.get<SpaceDetails>(pathFor(spaceId)),
  join: (spaceId: string) => api.post<{ role: SpaceRole }>(`${pathFor(spaceId)}/join`),
  leave: (spaceId: string) => api.post<void>(`${pathFor(spaceId)}/leave`),
  requestToSpeak: (spaceId: string) => api.post<{ id: string; state: string }>(`${pathFor(spaceId)}/speaker-requests`),
  approveSpeakerRequest: (spaceId: string, requestId: string) => api.post<void>(`${pathFor(spaceId)}/speaker-requests/${encodeURIComponent(requestId)}/approve`),
  declineSpeakerRequest: (spaceId: string, requestId: string) => api.post<void>(`${pathFor(spaceId)}/speaker-requests/${encodeURIComponent(requestId)}/decline`),
  muteSpeaker: (spaceId: string, userId: string) => api.post<void>(`${pathFor(spaceId)}/speakers/${encodeURIComponent(userId)}/mute`),
  removeSpeaker: (spaceId: string, userId: string) => api.post<void>(`${pathFor(spaceId)}/speakers/${encodeURIComponent(userId)}/remove`),
  demoteSpeaker: (spaceId: string, userId: string) => api.post<void>(`${pathFor(spaceId)}/speakers/${encodeURIComponent(userId)}/demote`),
  start: (spaceId: string) => api.post<void>(`${pathFor(spaceId)}/start`, undefined, { idempotencyKey: generateIdempotencyKey() }),
  end: (spaceId: string) => api.post<void>(`${pathFor(spaceId)}/end`, undefined, { idempotencyKey: generateIdempotencyKey() }),
  cancel: (spaceId: string) => api.post<void>(`${pathFor(spaceId)}/cancel`, undefined, { idempotencyKey: generateIdempotencyKey() }),
  setReminder: (spaceId: string) => api.put<void>(`${pathFor(spaceId)}/reminder`),
  removeReminder: (spaceId: string) => api.delete<void>(`${pathFor(spaceId)}/reminder`),
  announce: (spaceId: string) => api.post<void>(`${pathFor(spaceId)}/announcement`, undefined, { idempotencyKey: generateIdempotencyKey() }),
};
