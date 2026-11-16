import type { ApiRequestOptions } from "./apiClient";

export type MessengerStoryRequest = <T>(path: string, options?: Omit<ApiRequestOptions, "accessToken">) => Promise<T>;

export interface MessengerStoryPerson {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
}

export interface MessengerStoryTrayItem {
  readonly user: MessengerStoryPerson;
  readonly hasUnseen: boolean;
}

export interface MessengerStory {
  readonly id: string;
  readonly author: MessengerStoryPerson;
  readonly media: { readonly type: "image" | "video"; readonly url: string | null; readonly posterUrl: string | null; readonly status: string };
  readonly createdAt: string;
  readonly seen: boolean;
}

export interface MessengerStoryPublishInput {
  readonly mediaId: string;
}

export interface MessengerStoryReplyEncryption {
  readonly deviceId: string;
  readonly ciphertext: string;
  readonly protocol?: string;
}

function listPayload(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value;
  if (value !== null && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) return (value as { data: readonly unknown[] }).data;
  return [];
}

function parsePerson(value: unknown): MessengerStoryPerson | null {
  if (value === null || typeof value !== "object") return null;
  const person = value as Record<string, unknown>;
  if (typeof person.id !== "string" || typeof person.name !== "string" || typeof person.username !== "string") return null;
  return { id: person.id, name: person.name, username: person.username, avatarUrl: typeof person.avatarUrl === "string" ? person.avatarUrl : null };
}

export function parseStoryTray(value: unknown): readonly MessengerStoryTrayItem[] {
  return listPayload(value).flatMap((entry) => {
    if (entry === null || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const user = parsePerson(record.user);
    return user === null ? [] : [{ user, hasUnseen: record.hasUnseen === true }];
  });
}

export function parseUserStories(value: unknown): readonly MessengerStory[] {
  return listPayload(value).flatMap((entry) => {
    if (entry === null || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const author = parsePerson(record.author);
    const media = record.media;
    if (author === null || typeof record.id !== "string" || typeof record.createdAt !== "string" || media === null || typeof media !== "object") return [];
    const mediaRecord = media as Record<string, unknown>;
    if (mediaRecord.type !== "image" && mediaRecord.type !== "video") return [];
    return [{
      id: record.id,
      author,
      media: {
        type: mediaRecord.type,
        url: typeof mediaRecord.url === "string" ? mediaRecord.url : null,
        posterUrl: typeof mediaRecord.posterUrl === "string" ? mediaRecord.posterUrl : null,
        status: typeof mediaRecord.status === "string" ? mediaRecord.status : "ready",
      },
      createdAt: record.createdAt,
      seen: record.seen === true,
    }];
  });
}

export const messengerStoriesService = {
  fetchTray: (request: MessengerStoryRequest) => request<unknown>("/api/v1/stories/tray").then(parseStoryTray),
  fetchForUser: (request: MessengerStoryRequest, userId: string) => request<unknown>(`/api/v1/users/${encodeURIComponent(userId)}/stories`).then(parseUserStories),
  markSeen: (request: MessengerStoryRequest, storyId: string) => request<void>(`/api/v1/stories/${encodeURIComponent(storyId)}/seen`, { method: "POST" }),
  replyToStory: (request: MessengerStoryRequest, storyId: string, encryption: MessengerStoryReplyEncryption, idempotencyKey: string) =>
    request<{ readonly id: string }>(`/api/v1/stories/${encodeURIComponent(storyId)}/replies`, { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: { encryption } }),
  publishPhoto: (request: MessengerStoryRequest, input: MessengerStoryPublishInput) =>
    request<unknown>("/api/v1/stories", { method: "POST", body: input }),
};
