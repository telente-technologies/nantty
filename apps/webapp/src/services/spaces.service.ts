import {
  createIdempotencyKey,
  sendRequestToWebappServer as request,
  sendListRequestToWebappServer as list,
} from "./clientApi.service";
import { composerService } from "./composer.service";
export interface SpacePerson {
  id: string;
  name?: string | null;
  avatarUrl?: string | null;
  role: string;
  muted?: boolean;
}
export interface Space {
  announcementPostId?: string;
  id: string;
  title: string;
  description?: string;
  state: "live" | "scheduled" | "ended" | "cancelled";
  scheduledAt?: string;
  listenerCount: number;
  host: SpacePerson;
  speakers?: SpacePerson[];
  viewerRole?: string;
  viewerJoined?: boolean;
  giftsEnabled?: boolean;
  pendingSpeakerRequests?: { id: string; user: SpacePerson }[];
}
export interface SpaceGrant {
  spaceId: string;
  role: string;
  token: string;
  url: string;
  canPublish: boolean;
  demo?: boolean;
}
const path = (id: string) => `/api/v1/spaces/${encodeURIComponent(id)}`;
const mutate = <T = void>(
  id: string,
  action: string,
  body?: unknown,
  key = createIdempotencyKey("space"),
) =>
  request<T>(`${path(id)}/${action}`, {
    method: "POST",
    body,
    idempotencyKey: key,
  });
export const spacesService = {
  list: () =>
    list<Space>("/api/v1/spaces", {
      query: { state: "live,upcoming", limit: 30 },
    }),
  detail: (id: string) => request<Space>(path(id)),
  create: (input: {
    title: string;
    description: string;
    giftsEnabled: boolean;
    scheduledAt?: string;
  }, key = createIdempotencyKey("space")) =>
    request<Space>("/api/v1/spaces", {
      method: "POST",
      body: { ...input, visibility: "public" },
      idempotencyKey: key,
    }),
  join: (id: string) => mutate<SpaceGrant>(id, "join"),
  action: (id: string, action: string) => mutate(id, action),
  announce: (space: Space) =>
    composerService.publishPost(
      {
        text: `Join my Space: ${space.title}\n${window.location.origin}/spaces/${encodeURIComponent(space.id)}`,
        mediaIds: [],
        audience: "everyone",
      },
      `space-announcement-${space.id}`,
    ),
  gifts: () =>
    request<{ data: { id: string; name: string; priceCoins: number }[] }>(
      "/api/v1/gifts",
    ),
  gift: (id: string, giftId: string, key: string) =>
    mutate<{ id: string; hostUserId: string; totalCoins: number; senderCoinBalance: number }>(id, "gifts", { giftId, quantity: 1 }, key),
  setCoinDonations: (id: string, enabled: boolean) =>
    request<{ spaceId: string; giftsEnabled: boolean }>(`${path(id)}/coin-donations`, { method: "PATCH", body: { enabled }, idempotencyKey: createIdempotencyKey("space-donations") }),
  donateCoins: (id: string, coins: number, key: string) =>
    request<{ id: string; hostUserId: string; totalCoins: number; senderCoinBalance: number }>(`${path(id)}/coin-donations`, { method: "POST", body: { coins }, idempotencyKey: key }),
  attachAnnouncement: (id: string, postId: string) =>
    mutate(id, "announcement", { postId }, `space-attachment-${postId}`),
};
