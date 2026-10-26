import { useCallback, useEffect, useState } from "react";
import type { Room } from "livekit-client";

import { ApiError } from "@/errors/api.error";
import { loadLiveKitRuntime, type LiveKitRuntime } from "@/services/live/liveKitRuntime.service";
import { classifyRoomDisconnect, MAX_ROOM_RECONNECT_ATTEMPTS, nextReconnectDelayMs, type LiveMediaStatus } from "@/services/live/liveMediaPolicy.util";
import { spacesService, type SpaceJoinGrant } from "@/services/spaces.service";

export interface SpaceAudioConnection {
  readonly room: Room | null;
  readonly runtime: LiveKitRuntime | null;
  readonly status: LiveMediaStatus;
  readonly error: string | null;
  readonly canPublish: boolean;
  readonly isMuted: boolean;
  readonly toggleMicrophone: () => Promise<void>;
  readonly retry: () => void;
}

async function startSpaceAudioSession(runtime: LiveKitRuntime, canPublish: boolean) {
  const { AudioSession, AndroidAudioTypePresets } = runtime.native;
  await AudioSession.configureAudio({
    android: {
      preferredOutputList: ["bluetooth", "headset", "speaker"],
      audioTypeOptions: canPublish ? AndroidAudioTypePresets.communication : AndroidAudioTypePresets.media,
    },
    ios: { defaultOutput: "speaker" },
  });
  await AudioSession.startAudioSession();
}

function mayPublishAudio(grant: SpaceJoinGrant): boolean {
  return grant.canPublish && (grant.role === "host" || grant.role === "speaker");
}

export function useSpaceAudioConnection(spaceId: string, enabled: boolean, joinGrant: SpaceJoinGrant | null): SpaceAudioConnection {
  const runtime = enabled ? loadLiveKitRuntime() : null;
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<LiveMediaStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const retry = useCallback(() => setRetryKey((value) => value + 1), []);

  useEffect(() => {
    if (!enabled || !joinGrant || !runtime) return undefined;

    const liveKit = runtime;
    const { RoomEvent } = liveKit.client;
    let cancelled = false;
    let attempt = 0;
    let useInitialGrant = retryKey === 0;
    let current: Room | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const dropRoom = () => {
      const previous = current;
      current = null;
      previous?.removeAllListeners();
      void previous?.disconnect();
    };

    const scheduleRetry = () => {
      dropRoom();
      setRoom(null);
      setCanPublish(false);
      if (attempt >= MAX_ROOM_RECONNECT_ATTEMPTS) {
        setStatus("failed");
        setError("Couldn't reconnect to this Space. Check your connection and try again.");
        return;
      }
      setStatus("reconnecting");
      retryTimer = setTimeout(() => void connect(), nextReconnectDelayMs(attempt));
      attempt += 1;
    };

    const connect = async () => {
      if (cancelled) return;
      setStatus((previous) => previous === "reconnecting" ? previous : "connecting");
      setError(null);
      try {
        const grant = useInitialGrant ? joinGrant : await spacesService.join(spaceId);
        useInitialGrant = false;
        if (cancelled) return;
        if (!grant.url || !grant.token) throw new Error("The Space did not return an audio connection grant.");
        const publisher = mayPublishAudio(grant);
        const next = liveKit.createRoom();
        current = next;
        next
          .on(RoomEvent.Reconnecting, () => setStatus("reconnecting"))
          .on(RoomEvent.Reconnected, () => { setStatus("connected"); setError(null); })
          .on(RoomEvent.Disconnected, (reason) => {
            if (cancelled || current !== next) return;
            const outcome = classifyRoomDisconnect(reason);
            if (outcome === "retry") scheduleRetry();
            else {
              setStatus(outcome === "stopped" ? "idle" : outcome);
              if (outcome === "ended") setError("This Space has ended.");
              if (outcome === "removed") setError("You were removed from this Space.");
            }
          });

        await startSpaceAudioSession(liveKit, publisher);
        await next.connect(grant.url, grant.token, { autoSubscribe: true });
        if (cancelled || current !== next) {
          void next.disconnect();
          return;
        }
        attempt = 0;
        setCanPublish(publisher);
        setIsMuted(true);
        setRoom(next);
        setStatus("connected");
      } catch (cause) {
        if (cancelled) return;
        dropRoom();
        if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403 || cause.status === 404 || cause.status === 409)) {
          setStatus(cause.status === 409 ? "ended" : "failed");
          setError(cause.message || "You can't connect to this Space.");
          return;
        }
        if (attempt >= MAX_ROOM_RECONNECT_ATTEMPTS) {
          setStatus("failed");
          setError(cause instanceof Error ? cause.message : "Couldn't connect to Space audio.");
          return;
        }
        setError(cause instanceof Error ? cause.message : "Couldn't connect to Space audio.");
        scheduleRetry();
      }
    };

    void connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      dropRoom();
      setRoom(null);
      setCanPublish(false);
      setIsMuted(true);
      void liveKit.native.AudioSession.stopAudioSession().catch(() => undefined);
    };
  }, [enabled, joinGrant, retryKey, runtime, spaceId]);

  const toggleMicrophone = useCallback(async () => {
    if (!room || !canPublish || status !== "connected") return;
    const nextMuted = !isMuted;
    try {
      await room.localParticipant.setMicrophoneEnabled(!nextMuted);
      setIsMuted(nextMuted);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't change your microphone state.");
    }
  }, [canPublish, isMuted, room, status]);

  const visibleStatus: LiveMediaStatus = !enabled || !joinGrant ? "idle" : !runtime ? "unavailable" : status;
  const visibleError = !enabled || !joinGrant ? null : !runtime ? "Live audio isn't available in this app build." : error;
  return {
    room: enabled && joinGrant ? room : null,
    runtime,
    status: visibleStatus,
    error: visibleError,
    canPublish: Boolean(enabled && joinGrant && canPublish),
    isMuted: !enabled || !joinGrant || isMuted,
    toggleMicrophone,
    retry,
  };
}
