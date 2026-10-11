import { useCallback, useEffect, useState } from "react";
import type { Room } from "livekit-client";

import { ApiError } from "@/errors/api.error";
import { loadLiveKitRuntime, type LiveKitRuntime } from "@/services/live/liveKitRuntime.service";
import { liveMediaService } from "@/services/live/liveMedia.service";
import {
  classifyRoomDisconnect,
  MAX_ROOM_RECONNECT_ATTEMPTS,
  nextReconnectDelayMs,
  readConnectionQuality,
  type LiveConnectionQuality,
  type LiveMediaStatus,
} from "@/services/live/liveMediaPolicy.util";

export interface LiveRoomConnection {
  readonly room: Room | null;
  readonly runtime: LiveKitRuntime | null;
  readonly status: LiveMediaStatus;
  readonly quality: LiveConnectionQuality;
  readonly canPublish: boolean;
  readonly revision: number;
  readonly retry: () => void;
}

export interface LiveRoomConnectionOptions {
  readonly isEnabled: boolean;
  readonly isPublisher: boolean;
}

const ENDED_LIVE_CODES = new Set(["LIVE_NOT_ACTIVE", "LIVE_NOT_FOUND"]);

async function startAudioSession(runtime: LiveKitRuntime, isPublisher: boolean) {
  const { AudioSession, AndroidAudioTypePresets } = runtime.native;
  await AudioSession.configureAudio({
    android: {
      preferredOutputList: ["bluetooth", "headset", "speaker"],
      audioTypeOptions: isPublisher ? AndroidAudioTypePresets.communication : AndroidAudioTypePresets.media,
    },
    ios: { defaultOutput: "speaker" },
  });
  await AudioSession.startAudioSession();
}

export function useLiveRoomConnection(liveId: string, { isEnabled, isPublisher }: LiveRoomConnectionOptions): LiveRoomConnection {
  const runtime = isEnabled ? loadLiveKitRuntime() : null;
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<LiveMediaStatus>("idle");
  const [quality, setQuality] = useState<LiveConnectionQuality>("unknown");
  const [canPublish, setCanPublish] = useState(false);
  const [revision, setRevision] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  useEffect(() => {
    if (!isEnabled) return undefined;
    const liveKit = runtime;
    if (!liveKit) return undefined;
    const { RoomEvent } = liveKit.client;
    let isCancelled = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let current: Room | null = null;
    const bump = () => setRevision((value) => value + 1);

    const dropCurrentRoom = () => {
      const previous = current;
      current = null;
      previous?.removeAllListeners();
      void previous?.disconnect();
    };

    const scheduleRetry = () => {
      dropCurrentRoom();
      setRoom(null);
      if (attempt >= MAX_ROOM_RECONNECT_ATTEMPTS) {
        setStatus("failed");
        return;
      }
      setStatus("reconnecting");
      retryTimer = setTimeout(connect, nextReconnectDelayMs(attempt));
      attempt += 1;
    };

    const connect = async () => {
      if (isCancelled) return;
      setStatus((previous) => (previous === "reconnecting" ? previous : "connecting"));
      try {
        const grant = await liveMediaService.issueMediaToken(liveId);
        if (isCancelled) return;
        const next = liveKit.createRoom();
        current = next;
        next
          .on(RoomEvent.Reconnecting, () => setStatus("reconnecting"))
          .on(RoomEvent.Reconnected, () => setStatus("connected"))
          .on(RoomEvent.ConnectionQualityChanged, (value, participant) => {
            if (participant.isLocal) setQuality(readConnectionQuality(value));
          })
          .on(RoomEvent.Disconnected, (reason) => {
            if (isCancelled || current !== next) return;
            const outcome = classifyRoomDisconnect(reason);
            if (outcome === "retry") scheduleRetry();
            else setStatus(outcome === "stopped" ? "idle" : outcome);
          })
          .on(RoomEvent.TrackSubscribed, bump)
          .on(RoomEvent.TrackUnsubscribed, bump)
          .on(RoomEvent.TrackMuted, bump)
          .on(RoomEvent.TrackUnmuted, bump)
          .on(RoomEvent.LocalTrackPublished, bump)
          .on(RoomEvent.LocalTrackUnpublished, bump)
          .on(RoomEvent.ParticipantConnected, bump)
          .on(RoomEvent.ParticipantDisconnected, bump);
        await startAudioSession(liveKit, isPublisher && grant.canPublish).catch(() => undefined);
        await next.connect(grant.url, grant.token, { autoSubscribe: true });
        if (isCancelled || current !== next) {
          void next.disconnect();
          return;
        }
        attempt = 0;
        setCanPublish(grant.canPublish);
        setRoom(next);
        setStatus("connected");
        bump();
      } catch (error) {
        if (isCancelled) return;
        if (error instanceof ApiError && ENDED_LIVE_CODES.has(error.code ?? "")) {
          dropCurrentRoom();
          setStatus("ended");
          return;
        }
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          dropCurrentRoom();
          setStatus("failed");
          return;
        }
        scheduleRetry();
      }
    };

    void connect();
    return () => {
      isCancelled = true;
      clearTimeout(retryTimer);
      dropCurrentRoom();
      setRoom(null);
      setCanPublish(false);
      void liveKit.native.AudioSession.stopAudioSession().catch(() => undefined);
    };
  }, [liveId, isEnabled, isPublisher, runtime, retryKey]);

  return { room, runtime, status: isEnabled && !runtime ? "unavailable" : status, quality, canPublish, revision, retry };
}
