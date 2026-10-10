import type { Clip, ClipSound, ID, Page, UpdateSoundInput } from "@/types";

import { api } from "../core/apiClient.service";

export const describeClipSoundForDisplay = (sound: ClipSound) =>
  sound.isOriginal ? `Original sound · @${sound.owner.username}` : `${sound.title} · @${sound.owner.username}`;

export const explainWhySoundCannotBeReused = (sound: ClipSound): string | null => {
  if (sound.status === "under_copyright_review") return "This sound is unavailable while under copyright review";
  if (sound.status === "removed") return "This sound was removed";
  if (!sound.allowReuse) return `@${sound.owner.username} turned off reuse for this sound`;
  return null;
};

export const soundsService = {
  searchSounds: (query: string) => api.getList<ClipSound>("/api/v1/sounds", { q: query }),
  fetchTrendingSounds: () => api.getList<ClipSound>("/api/v1/sounds/trending"),
  fetchSavedSounds: () => api.getList<ClipSound>("/api/v1/sounds/saved"),
  fetchSoundById: (soundId: ID) => api.get<ClipSound>(`/api/v1/sounds/${soundId}`),
  fetchClipsUsingSound: (soundId: ID, cursor?: string) => api.get<Page<Clip>>(`/api/v1/sounds/${soundId}/clips`, { cursor }),
  updateSoundAsOwner: (soundId: ID, input: UpdateSoundInput) => api.patch<ClipSound>(`/api/v1/sounds/${soundId}`, input),
  saveSound: (soundId: ID) => api.post<void>(`/api/v1/sounds/${soundId}/save`),
  unsaveSound: (soundId: ID) => api.delete<void>(`/api/v1/sounds/${soundId}/save`),
};
