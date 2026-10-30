import { api, generateIdempotencyKey } from "./core/apiClient.service";

export type SpaceState = "live" | "scheduled" | "ended" | "cancelled";
export type SpaceRole = "host" | "moderator" | "speaker" | "listener";
export type SpaceVisibility = "public" | "followers" | "subscribers" | "invite_only";

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
  readonly visibility?: SpaceVisibility;
}

export interface SpaceDetails extends SpaceSummary {
  readonly giftsEnabled: boolean;
  readonly announcementPostId?: string;
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

/** Short-lived, audio-only LiveKit grant returned by POST /spaces/:id/join. */
export interface SpaceJoinGrant {
  readonly demo?: boolean;
  readonly spaceId: string;
  readonly role: SpaceRole;
  readonly token: string;
  readonly url: string;
  readonly canPublish: boolean;
  readonly listeners: number;
}

export interface CreateSpaceInput {
  readonly title: string;
  readonly description?: string;
  readonly audiencePolicy: SpaceVisibility;
  readonly scheduledAt?: string;
}

const mutationOptions = () => ({ idempotencyKey: generateIdempotencyKey() });
const pathFor = (spaceId: string) => `/api/v1/spaces/${encodeURIComponent(spaceId)}`;

export const spacesService = {
  list: (cursor?: string) => api.getPage<SpaceSummary>("/api/v1/spaces", { state: "live,upcoming", cursor, limit: 30 }),
  create: ({ audiencePolicy, ...input }: CreateSpaceInput, key = generateIdempotencyKey()) => api.post<SpaceSummary>("/api/v1/spaces", { ...input, visibility: audiencePolicy }, { idempotencyKey: key }),
  detail: (spaceId: string) => api.get<SpaceDetails>(pathFor(spaceId)),
  join: (spaceId: string) => api.post<SpaceJoinGrant>(`${pathFor(spaceId)}/join`, undefined, mutationOptions()),
  leave: (spaceId: string) => api.post<void>(`${pathFor(spaceId)}/leave`, undefined, mutationOptions()),
  requestToSpeak: (spaceId: string) => api.post<{ id: string; state: string }>(`${pathFor(spaceId)}/speaker-requests`, undefined, mutationOptions()),
  approveSpeakerRequest: (spaceId: string, requestId: string) => api.post<void>(`${pathFor(spaceId)}/speaker-requests/${encodeURIComponent(requestId)}/approve`, undefined, mutationOptions()),
  declineSpeakerRequest: (spaceId: string, requestId: string) => api.post<void>(`${pathFor(spaceId)}/speaker-requests/${encodeURIComponent(requestId)}/decline`, undefined, mutationOptions()),
  muteSpeaker: (spaceId: string, userId: string) => api.post<void>(`${pathFor(spaceId)}/speakers/${encodeURIComponent(userId)}/mute`, undefined, mutationOptions()),
  removeSpeaker: (spaceId: string, userId: string) => api.post<void>(`${pathFor(spaceId)}/speakers/${encodeURIComponent(userId)}/remove`, undefined, mutationOptions()),
  demoteSpeaker: (spaceId: string, userId: string) => api.post<void>(`${pathFor(spaceId)}/speakers/${encodeURIComponent(userId)}/demote`, undefined, mutationOptions()),
  start: (spaceId: string) => api.post<void>(`${pathFor(spaceId)}/start`, undefined, { idempotencyKey: generateIdempotencyKey() }),
  end: (spaceId: string) => api.post<void>(`${pathFor(spaceId)}/end`, undefined, { idempotencyKey: generateIdempotencyKey() }),
  cancel: (spaceId: string) => api.post<void>(`${pathFor(spaceId)}/cancel`, undefined, { idempotencyKey: generateIdempotencyKey() }),
  announce: (spaceId: string, title: string, url: string) => api.post<{ id: string }>("/api/v1/posts", { text: `Join my Space: ${title}\n${url}`, audience: "everyone", mediaIds: [] }, { idempotencyKey: `space-announcement-${spaceId}` }),
  sendGift: (spaceId: string, giftId: string, idempotencyKey: string) => api.post(`${pathFor(spaceId)}/gifts`, { giftId, quantity: 1 }, { idempotencyKey }),
  attachAnnouncement: (spaceId: string, postId: string) => api.post(`${pathFor(spaceId)}/announcement`, { postId }, { idempotencyKey: `space-attachment-${postId}` }),
  invite: (spaceId: string, accountId: string) => api.post<void>(`${pathFor(spaceId)}/invites`, { accountId }, mutationOptions()),
};
