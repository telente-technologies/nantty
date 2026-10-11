"use client";

import type { RemoteParticipant, RemoteTrack, Room } from "livekit-client";
import { useEffect, useRef, useState } from "react";

import styles from "@/components/live/liveRoom.module.css";
import { MediaImage } from "@/components/ui/media";
import { WebappRequestError } from "@/services/clientApi.service";
import { liveService } from "@/services/webActions.service";
import { canUseWebRtc, isBlockedUriForHost, liveVideoStateMessage, readUrlHost, stateAfterRoomDisconnect, type LiveVideoState } from "@/utils/liveRoom.util";

export interface LiveVideoPlayerProps {
  readonly liveId: string;
  readonly hostId: string;
  readonly coverUrl: string | null;
  readonly isSignedIn: boolean;
  readonly isOwnLive: boolean;
  readonly onRoomClosed: () => void;
}

const MAX_RETRIES = 5;

export function LiveVideoPlayer({ liveId, hostId, coverUrl, isSignedIn, isOwnLive, onRoomClosed }: LiveVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const roomRef = useRef<Room | null>(null);
  const onRoomClosedRef = useRef(onRoomClosed);
  const gate: LiveVideoState | null = isOwnLive ? "ownLive" : isSignedIn ? null : "signedOut";
  const [connectionState, setState] = useState<LiveVideoState>("connecting");
  const state = gate ?? connectionState;
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    onRoomClosedRef.current = onRoomClosed;
  });

  useEffect(() => {
    if (isOwnLive || !isSignedIn) return undefined;
    let isCancelled = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let isBlockedByPolicy = false;
    let mediaHost = "";
    const noticePolicyBlock = (event: SecurityPolicyViolationEvent) => {
      if (!mediaHost || !isBlockedUriForHost(event.blockedURI, mediaHost)) return;
      isBlockedByPolicy = true;
      clearTimeout(retryTimer);
      setState("unavailable");
    };
    document.addEventListener("securitypolicyviolation", noticePolicyBlock);

    const connect = async () => {
      const client = await import("livekit-client");
      if (isCancelled) return;
      if (!canUseWebRtc(window as unknown as { RTCPeerConnection?: unknown })) return setState("blocked");
      const { Room, RoomEvent, Track, ParticipantKind } = client;
      const isStreamer = (participant: RemoteParticipant) => participant.identity === hostId || participant.kind === ParticipantKind.INGRESS;
      const attachTrack = (track: RemoteTrack, participant: RemoteParticipant) => {
        if (!isStreamer(participant)) return;
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          setState("playing");
        }
        if (track.kind === Track.Kind.Audio && audioRef.current) track.attach(audioRef.current);
      };
      const room = new Room({ adaptiveStream: true, dynacast: false });
      roomRef.current = room;
      room
        .on(RoomEvent.TrackSubscribed, (track, _publication, participant) => attachTrack(track, participant))
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach();
          if (track.kind === Track.Kind.Video) setState("waiting");
        })
        .on(RoomEvent.TrackMuted, (publication) => {
          if (publication.kind === Track.Kind.Video) setState("waiting");
        })
        .on(RoomEvent.TrackUnmuted, (publication) => {
          if (publication.kind === Track.Kind.Video) setState("playing");
        })
        .on(RoomEvent.Reconnecting, () => setState("reconnecting"))
        .on(RoomEvent.Reconnected, () => setState(videoRef.current?.srcObject ? "playing" : "waiting"))
        .on(RoomEvent.Disconnected, (reason) => {
          if (isCancelled || roomRef.current !== room) return;
          const next = stateAfterRoomDisconnect(reason);
          if (next === "ended") onRoomClosedRef.current();
          if (next !== "retry") return setState(next);
          scheduleRetry();
        });
      try {
        const grant = await liveService.issueMediaToken(liveId);
        if (isCancelled) return;
        mediaHost = readUrlHost(grant.url);
        await room.connect(grant.url, grant.token, { autoSubscribe: true });
        if (isCancelled) return void room.disconnect();
        attempt = 0;
        setState("waiting");
        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            if (publication.track) attachTrack(publication.track, participant);
          }
        }
      } catch (error) {
        if (isCancelled) return;
        if (error instanceof WebappRequestError && error.status > 0 && error.status < 500) {
          if (error.code === "LIVE_NOT_ACTIVE") onRoomClosedRef.current();
          setState(error.code === "LIVE_NOT_ACTIVE" ? "ended" : error.code === "LIVE_VIDEO_MOCK_PREVIEW" ? "mockPreview" : "unavailable");
          return;
        }
        scheduleRetry();
      }
    };

    const scheduleRetry = () => {
      if (isBlockedByPolicy) return;
      const previous = roomRef.current;
      roomRef.current = null;
      previous?.removeAllListeners();
      void previous?.disconnect();
      if (attempt >= MAX_RETRIES) return setState("blocked");
      setState("reconnecting");
      retryTimer = setTimeout(() => void connect(), Math.min(15_000, 1_000 * 2 ** attempt));
      attempt += 1;
    };

    void connect();
    return () => {
      isCancelled = true;
      document.removeEventListener("securitypolicyviolation", noticePolicyBlock);
      clearTimeout(retryTimer);
      const room = roomRef.current;
      roomRef.current = null;
      room?.removeAllListeners();
      void room?.disconnect();
    };
  }, [liveId, hostId, isSignedIn, isOwnLive]);

  const toggleSound = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextMuted = !isMuted;
    audio.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted) void roomRef.current?.startAudio().then(() => audio.play()).catch(() => undefined);
  };

  const message = liveVideoStateMessage(state);
  return (
    <>
      {state === "playing" || state === "reconnecting" ? null : <MediaImage src={coverUrl} alt="" sizes="(max-width: 1024px) 100vw, 720px" />}
      <video ref={videoRef} className={styles.video} hidden={state !== "playing" && state !== "reconnecting"} autoPlay muted playsInline aria-label="Live video" />
      <audio ref={audioRef} autoPlay muted />
      {state === "connecting" ? <span className={styles.videoNotice} role="status">Loading the live video…</span> : null}
      {message ? <span className={styles.videoNotice} role="status">{message}</span> : null}
      {state === "playing" ? (
        <button type="button" className={styles.soundButton} aria-pressed={!isMuted} onClick={toggleSound}>
          {isMuted ? "Tap to unmute" : "Mute"}
        </button>
      ) : null}
    </>
  );
}
