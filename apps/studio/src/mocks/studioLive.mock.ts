import { ApiError } from "@/errors/api.error";
import type { LiveCategory } from "@/types";
import type { CommentAudience, HostDefaults, LiveRecording, RoomSettings, StreamHealth } from "@/types/studioLive.type";

import { findLiveOrThrow, patchLive, requireMockHost, validateMockSchedule } from "./lives.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const LIVE_CATEGORIES: readonly LiveCategory[] = ["justChatting", "gaming", "music", "irl", "education", "shopping"];
const COMMENT_AUDIENCES: readonly CommentAudience[] = ["everyone", "followers", "subscribers"];
const MODERATOR_DIRECTORY = [
  { id: "f_0", name: "Kemi Ade", username: "kemi.ade", avatarUrl: null },
  { id: "f_1", name: "Chidi Okafor", username: "chidi.okafor", avatarUrl: null },
  { id: "f_2", name: "Bola Tinubu", username: "bola.tinubu", avatarUrl: null },
  { id: "f_3", name: "Amaka Eze", username: "amaka.eze", avatarUrl: null },
  { id: "f_4", name: "Tobi Bakare", username: "tobi.bakare", avatarUrl: null },
];

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

const recordings = new Map<string, LiveRecording[]>([
  ["live_2", [
    { id: "rec_2a", liveId: "live_2", state: "completed", durationSeconds: 3540, sizeBytes: 812_000_000, createdAt: hoursAgo(51), completedAt: hoursAgo(50), playbackUrl: "https://studio.zudomart.com/replays/live_2/rec_2a.mp4" },
    { id: "rec_2b", liveId: "live_2", state: "failed", durationSeconds: 0, sizeBytes: 0, createdAt: hoursAgo(51), completedAt: hoursAgo(51), playbackUrl: null },
  ]],
]);

const roomSettings = new Map<string, Omit<RoomSettings, "liveId" | "myRole">>();

let hostDefaults: HostDefaults = { commentsEnabled: true, commentAudience: "everyone", slowModeSeconds: 0, blockedWords: [], moderators: [], updatedAt: null };

export const normaliseMockBlockedWords = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) throw new ApiError(400, "blockedWords must be a list", "VALIDATION_FAILED");
  const cleaned = [...new Set(raw.map((word) => String(word).trim().toLowerCase()).filter(Boolean))];
  if (cleaned.some((word) => [...word].length < 2 || [...word].length > 30)) throw new ApiError(422, "Blocked words must be 2-30 characters.", "BLOCKED_WORD_INVALID");
  if (cleaned.length > 100) throw new ApiError(422, "You can block at most 100 words.", "BLOCKED_WORDS_LIMIT");
  return cleaned;
};

const readModerationInput = (body: unknown) => {
  const payload = (body ?? {}) as Record<string, unknown>;
  const slowModeSeconds = payload.slowModeSeconds === undefined ? undefined : Number(payload.slowModeSeconds);
  if (slowModeSeconds !== undefined && (!Number.isInteger(slowModeSeconds) || slowModeSeconds < 0 || slowModeSeconds > 300)) throw new ApiError(400, "slowModeSeconds must be 0-300", "VALIDATION_FAILED");
  if (payload.commentAudience !== undefined && !COMMENT_AUDIENCES.includes(payload.commentAudience as CommentAudience)) throw new ApiError(400, "commentAudience is not supported", "VALIDATION_FAILED");
  return {
    commentsEnabled: typeof payload.commentsEnabled === "boolean" ? payload.commentsEnabled : undefined,
    commentAudience: payload.commentAudience as CommentAudience | undefined,
    slowModeSeconds,
    blockedWords: payload.blockedWords === undefined ? undefined : normaliseMockBlockedWords(payload.blockedWords),
  };
};

const presentRoomSettings = (liveId: string): RoomSettings => ({
  liveId, myRole: "host", recordEnabled: false,
  ...(roomSettings.get(liveId) ?? { commentsEnabled: hostDefaults.commentsEnabled, commentAudience: hostDefaults.commentAudience, slowModeSeconds: hostDefaults.slowModeSeconds, blockedWords: hostDefaults.blockedWords }),
});

const buildStreamHealth = (liveId: string): StreamHealth => {
  const live = requireMockHost(liveId);
  const hasKey = Boolean(live.streamKey || live.whipKey);
  const publishing = live.state === "live";
  return {
    liveId, state: live.state, viewers: live.viewers, peakViewers: live.peakViewers, startedAt: live.startedAt, checkedAt: new Date().toISOString(),
    ingress: hasKey
      ? { protocol: live.whipKey ? "whip" : "rtmp", status: publishing ? "publishing" : "inactive", error: null, videoBitrateKbps: publishing ? 4200 : null, audioBitrateKbps: publishing ? 128 : null, width: publishing ? 1920 : null, height: publishing ? 1080 : null, framerate: publishing ? 30 : null }
      : null,
  };
};

const requireIdle = (liveId: string) => {
  const live = requireMockHost(liveId);
  if (live.state !== "idle") throw new ApiError(409, "Only lives that haven't started can be changed.", "LIVE_NOT_EDITABLE");
  return live;
};

export const studioLiveMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/lives/:liveId/stream-health", ({ params }) => buildStreamHealth(params.liveId!)),
  createMockRoute("PATCH", "/api/v1/lives/:liveId", ({ params, body }) => {
    requireIdle(params.liveId!);
    const payload = (body ?? {}) as { title?: unknown; category?: unknown; scheduledAt?: unknown };
    const title = payload.title === undefined ? undefined : String(payload.title).trim();
    if (title !== undefined && (!title || title.length > 140)) throw new ApiError(400, "title must be 1-140 characters", "VALIDATION_FAILED");
    if (payload.category !== undefined && !LIVE_CATEGORIES.includes(payload.category as LiveCategory)) throw new ApiError(400, "category is not supported", "VALIDATION_FAILED");
    const scheduledAt = "scheduledAt" in payload ? validateMockSchedule(payload.scheduledAt) : undefined;
    patchLive(params.liveId!, (live) => ({
      ...live,
      ...(title !== undefined ? { title } : {}),
      ...(payload.category !== undefined ? { category: payload.category as LiveCategory } : {}),
      ...(scheduledAt !== undefined ? { scheduledAt } : {}),
    }));
    const updated = findLiveOrThrow(params.liveId!);
    return { id: updated.id, title: updated.title, category: updated.category, state: updated.state, viewers: 0, peakViewers: 0, startedAt: null, endedAt: null, playbackUrl: null, storeId: updated.storeId, hostRanking: null, scheduledAt: updated.scheduledAt };
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/cancel", ({ params }) => {
    requireIdle(params.liveId!);
    patchLive(params.liveId!, (live) => ({ ...live, state: "ended", endedAt: new Date().toISOString(), streamKey: null, whipKey: null }));
    return undefined;
  }),
  createMockRoute("GET", "/api/v1/lives/:liveId/recordings", ({ params }) => {
    requireMockHost(params.liveId!);
    return { data: recordings.get(params.liveId!) ?? [], nextCursor: null };
  }),
  createMockRoute("DELETE", "/api/v1/lives/:liveId/recordings/:recordingId", ({ params }) => {
    requireMockHost(params.liveId!);
    const list = recordings.get(params.liveId!) ?? [];
    const target = list.find((recording) => recording.id === params.recordingId);
    if (!target) throw new ApiError(404, "That recording no longer exists.", "RECORDING_NOT_FOUND");
    if (target.state === "recording") throw new ApiError(409, "This recording is still in progress.", "RECORDING_IN_PROGRESS");
    recordings.set(params.liveId!, list.filter((recording) => recording.id !== target.id));
    return undefined;
  }),
  createMockRoute("GET", "/api/v1/lives/:liveId/room-settings", ({ params }) => {
    findLiveOrThrow(params.liveId!);
    return presentRoomSettings(params.liveId!);
  }),
  createMockRoute("PUT", "/api/v1/lives/:liveId/room-settings", ({ params, body }) => {
    requireMockHost(params.liveId!);
    const input = readModerationInput(body);
    const current = presentRoomSettings(params.liveId!);
    roomSettings.set(params.liveId!, {
      commentsEnabled: input.commentsEnabled ?? current.commentsEnabled,
      commentAudience: input.commentAudience ?? current.commentAudience,
      slowModeSeconds: input.slowModeSeconds ?? current.slowModeSeconds,
      blockedWords: input.blockedWords ?? current.blockedWords,
    });
    return presentRoomSettings(params.liveId!);
  }),
  createMockRoute("GET", "/api/v1/live/host-defaults", () => hostDefaults),
  createMockRoute("PUT", "/api/v1/live/host-defaults", ({ body }) => {
    const input = readModerationInput(body);
    const rawIds = (body as { moderatorIds?: unknown } | null)?.moderatorIds;
    if (rawIds !== undefined && !Array.isArray(rawIds)) throw new ApiError(400, "moderatorIds must be a list", "VALIDATION_FAILED");
    const moderatorIds = rawIds === undefined ? undefined : [...new Set(rawIds.map(String))];
    if (moderatorIds?.includes("u_me")) throw new ApiError(422, "You're already in charge of your lives.", "MODERATOR_SELF");
    if (moderatorIds && moderatorIds.length > 20) throw new ApiError(422, "You can add up to 20 moderators.", "VALIDATION_FAILED");
    hostDefaults = {
      commentsEnabled: input.commentsEnabled ?? hostDefaults.commentsEnabled,
      commentAudience: input.commentAudience ?? hostDefaults.commentAudience,
      slowModeSeconds: input.slowModeSeconds ?? hostDefaults.slowModeSeconds,
      blockedWords: input.blockedWords ?? hostDefaults.blockedWords,
      moderators: moderatorIds ? MODERATOR_DIRECTORY.filter((person) => moderatorIds.includes(person.id)) : hostDefaults.moderators,
      updatedAt: new Date().toISOString(),
    };
    return hostDefaults;
  }),
];
