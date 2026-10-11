import type { ID, LiveSessionWire, Page } from "@/types";
import type { EditLiveInput, HostDefaults, HostDefaultsInput, LiveRecording, RoomSettings, RoomSettingsInput, ScheduleLiveInput, StreamHealth } from "@/types/studioLive.type";

import { sendRequestToStudioServer } from "./clientApi.service";

const id = (value: ID) => encodeURIComponent(value);

export const studioLiveService = {
  fetchStreamHealth: (liveId: ID) => sendRequestToStudioServer<StreamHealth>(`/api/v1/lives/${id(liveId)}/stream-health`),
  scheduleLive: ({ title, category, scheduledAt, storeId }: ScheduleLiveInput) =>
    sendRequestToStudioServer<LiveSessionWire>("/api/v1/lives", { method: "POST", body: { title, category, startNow: false, scheduledAt, ...(storeId ? { storeId } : {}) } }),
  editLive: (liveId: ID, input: EditLiveInput) => sendRequestToStudioServer<LiveSessionWire>(`/api/v1/lives/${id(liveId)}`, { method: "PATCH", body: input }),
  cancelLive: (liveId: ID) => sendRequestToStudioServer<void>(`/api/v1/lives/${id(liveId)}/cancel`, { method: "POST" }),
  listRecordings: async (liveId: ID) => (await sendRequestToStudioServer<Page<LiveRecording>>(`/api/v1/lives/${id(liveId)}/recordings`)).data,
  deleteRecording: (liveId: ID, recordingId: ID) =>
    sendRequestToStudioServer<void>(`/api/v1/lives/${id(liveId)}/recordings/${id(recordingId)}`, { method: "DELETE" }),
  fetchRoomSettings: (liveId: ID) => sendRequestToStudioServer<RoomSettings>(`/api/v1/lives/${id(liveId)}/room-settings`),
  saveRoomSettings: (liveId: ID, input: RoomSettingsInput) => sendRequestToStudioServer<RoomSettings>(`/api/v1/lives/${id(liveId)}/room-settings`, { method: "PUT", body: input }),
  fetchHostDefaults: () => sendRequestToStudioServer<HostDefaults>("/api/v1/live/host-defaults"),
  saveHostDefaults: (input: HostDefaultsInput) => sendRequestToStudioServer<HostDefaults>("/api/v1/live/host-defaults", { method: "PUT", body: input }),
};
