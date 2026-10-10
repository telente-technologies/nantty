import type { Clip, ClipSound, ID, Page } from "@/types";

import { sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export const soundsService = {
  searchSounds: (query: string) => sendListRequestToWebappServer<ClipSound>("/api/v1/sounds", { query: { q: query } }),
  fetchTrendingSounds: () => sendListRequestToWebappServer<ClipSound>("/api/v1/sounds/trending"),
  fetchSavedSounds: () => sendListRequestToWebappServer<ClipSound>("/api/v1/sounds/saved"),
  fetchSoundById: (soundId: ID) => sendRequestToWebappServer<ClipSound>(`/api/v1/sounds/${encodeURIComponent(soundId)}`),
  fetchClipsUsingSound: (soundId: ID, cursor?: string) =>
    sendRequestToWebappServer<Page<Clip>>(`/api/v1/sounds/${encodeURIComponent(soundId)}/clips`, { query: { cursor } }),
  saveSound: (soundId: ID) => sendRequestToWebappServer<void>(`/api/v1/sounds/${encodeURIComponent(soundId)}/save`, { method: "POST" }),
  unsaveSound: (soundId: ID) => sendRequestToWebappServer<void>(`/api/v1/sounds/${encodeURIComponent(soundId)}/save`, { method: "DELETE" }),
};
