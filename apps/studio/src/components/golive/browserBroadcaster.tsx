"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { requestConfirmation } from "@zudomart/web-kit";

import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/field";
import { CameraIcon, CameraOffIcon, MicIcon, MicOffIcon, ScreenShareIcon } from "@/components/ui/icons";
import { useBroadcastMedia } from "@/live/useBroadcastMedia.hook";
import { publishOverWhip, WhipPublishError, type PublisherStats, type WhipSession } from "@/live/whipPublisher";
import { livesService } from "@/services/lives.service";
import type { ID, LiveState } from "@/types";
import { readLiveErrorMessage } from "@/utils/liveStoreErrors.util";

import styles from "./goLive.module.css";

type Phase = "preview" | "connecting" | "onAir" | "ending";

interface BrowserBroadcasterProps {
  readonly liveId: ID;
  readonly liveState: LiveState;
  readonly onStats: (stats: PublisherStats | null) => void;
  readonly onLiveChanged: () => void;
  readonly onUseEncoder: () => void;
  readonly encoderActive: boolean;
}

const STATS_INTERVAL_MS = 2000;

export function BrowserBroadcaster({ liveId, liveState, onStats, onLiveChanged, onUseEncoder, encoderActive }: BrowserBroadcasterProps) {
  const sessionRef = useRef<WhipSession | null>(null);
  const busyRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("preview");
  const [error, setError] = useState<string | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const onTrackChange = useCallback((kind: "audio" | "video", track: MediaStreamTrack | null) => {
    void sessionRef.current?.replaceTrack(kind, track);
  }, []);
  const media = useBroadcastMedia(onTrackChange);
  const ended = liveState === "ended";

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = media.stream;
  }, [media.stream]);

  useEffect(() => {
    if (phase !== "onAir") return;
    const session = sessionRef.current;
    if (!session) return;
    const unsubscribe = session.onStateChange((state) => setConnectionLost(state === "failed" || state === "disconnected"));
    const timer = window.setInterval(() => void session.readStats().then(onStats).catch(() => undefined), STATS_INTERVAL_MS);
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", warnBeforeLeaving);
    };
  }, [phase, onStats]);

  useEffect(() => () => {
    void sessionRef.current?.stop();
    sessionRef.current = null;
  }, []);

  useEffect(() => {
    if (!ended || !sessionRef.current) return;
    void sessionRef.current.stop();
    sessionRef.current = null;
    setPhase("preview");
    onStats(null);
    media.release();
  }, [ended, media.release, onStats]);

  async function goLive() {
    if (busyRef.current || !media.stream || encoderActive) return;
    busyRef.current = true;
    setError(null);
    setConnectionLost(false);
    setPhase("connecting");
    let session: WhipSession | null = null;
    try {
      await sessionRef.current?.stop();
      sessionRef.current = null;
      const key = await livesService.rotateStreamKey(liveId, "whip");
      session = await publishOverWhip(key.ingestUrl, key.streamKey, media.stream);
      if (liveState !== "live") await livesService.startLive(liveId);
      sessionRef.current = session;
      setPhase("onAir");
      onLiveChanged();
    } catch (failure) {
      await session?.stop();
      setError(failure instanceof WhipPublishError ? failure.message : readLiveErrorMessage(failure));
      setPhase("preview");
    } finally {
      busyRef.current = false;
    }
  }

  async function endLive() {
    if (busyRef.current) return;
    const confirmed = await requestConfirmation({ title: "End this live?", description: "Your camera stops, viewers are disconnected and the live can't be restarted.", confirmLabel: "End live", intent: "stop", tone: "danger" });
    if (!confirmed || busyRef.current) return;
    busyRef.current = true;
    setPhase("ending");
    try {
      await sessionRef.current?.stop();
      sessionRef.current = null;
      await livesService.endLive(liveId);
      onStats(null);
      media.release();
      setPhase("preview");
      onLiveChanged();
    } catch (failure) {
      setError(readLiveErrorMessage(failure));
      setPhase("onAir");
    } finally {
      busyRef.current = false;
    }
  }

  if (ended) return <p className={styles.muted}>This live has ended. Create a new live to go on air again.</p>;

  const hasPreview = media.permission === "granted" && media.stream !== null;
  const onAir = phase === "onAir";

  return (
    <div className={styles.broadcaster}>
      <div className={styles.stageColumn}>
        <div className={styles.stage}>
          {hasPreview ? (
            <video ref={videoRef} className={media.screenSharing ? styles.previewScreen : styles.preview} autoPlay muted playsInline aria-label="Your camera preview" />
          ) : (
            <div className={styles.stagePlaceholder}>
              <CameraIcon size={32} />
              <p>{media.permission === "requesting" ? "Waiting for you to allow camera and microphone…" : "Your preview appears here"}</p>
            </div>
          )}
          {hasPreview ? (
            <span className={onAir ? styles.onAirChip : styles.previewChip}>{onAir ? "On air" : phase === "connecting" ? "Connecting…" : "Preview only"}</span>
          ) : null}
          {hasPreview && !media.cameraOn && !media.screenSharing ? <span className={styles.stageNotice}>Camera off. Viewers see a black screen.</span> : null}
        </div>
        {hasPreview ? (
          <div className={styles.mediaControls} role="group" aria-label="Camera and microphone">
            <button type="button" className={styles.mediaToggle} aria-pressed={!media.microphoneOn} onClick={media.toggleMicrophone}>
              {media.microphoneOn ? <MicIcon size={20} /> : <MicOffIcon size={20} />}
              <span>{media.microphoneOn ? "Mute" : "Unmute"}</span>
            </button>
            <button type="button" className={styles.mediaToggle} aria-pressed={!media.cameraOn} onClick={media.toggleCamera}>
              {media.cameraOn ? <CameraIcon size={20} /> : <CameraOffIcon size={20} />}
              <span>{media.cameraOn ? "Turn camera off" : "Turn camera on"}</span>
            </button>
            <button type="button" className={styles.mediaToggle} aria-pressed={media.screenSharing} onClick={() => void media.toggleScreenShare()}>
              <ScreenShareIcon size={20} />
              <span>{media.screenSharing ? "Stop sharing" : "Share screen"}</span>
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.sideColumn}>
        {media.problem ? <p className={styles.alert} role="alert">{media.problem}</p> : null}
        {connectionLost ? <p className={styles.alert} role="alert">Your connection dropped. Viewers may see a frozen frame. Press Reconnect to resume.</p> : null}
        {error ? <p className={styles.alert} role="alert">{error}</p> : null}

        {!hasPreview ? (
          <div className={styles.accessCard}>
            <h3 className={styles.sideTitle}>Use your camera and microphone</h3>
            <p className={styles.muted}>Your browser asks for permission. Nothing is broadcast until you press Go live.</p>
            <Button busy={media.permission === "requesting"} onClick={() => void media.requestAccess()}>
              {media.permission === "denied" || media.permission === "unavailable" ? "Try again" : "Allow camera and microphone"}
            </Button>
            {media.permission === "denied" || media.permission === "unavailable" ? (
              <Button variant="ghost" onClick={onUseEncoder}>Stream with OBS instead</Button>
            ) : null}
          </div>
        ) : (
          <>
            <SelectField label="Camera" value={media.cameraId} onChange={(event) => void media.chooseCamera(event.target.value)} disabled={media.cameras.length === 0}>
              {media.cameras.length === 0 ? <option value="">No camera found</option> : null}
              {media.cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.label}</option>)}
            </SelectField>
            <SelectField label="Microphone" value={media.microphoneId} onChange={(event) => void media.chooseMicrophone(event.target.value)} disabled={media.microphones.length === 0}>
              {media.microphones.length === 0 ? <option value="">No microphone found</option> : null}
              {media.microphones.map((microphone) => <option key={microphone.id} value={microphone.id}>{microphone.label}</option>)}
            </SelectField>
            {encoderActive && !onAir ? <p className={styles.alert} role="alert">OBS or another encoder is streaming to this live. Stop it before going live from the browser.</p> : null}
            {!onAir || connectionLost ? (
              <Button busy={phase === "connecting"} disabled={encoderActive || phase === "ending"} onClick={() => void goLive()}>
                {connectionLost || liveState === "live" ? "Reconnect" : "Go live"}
              </Button>
            ) : null}
            {onAir || liveState === "live" ? (
              <Button variant="danger" busy={phase === "ending"} disabled={phase === "connecting"} onClick={() => void endLive()}>End live</Button>
            ) : null}
            <p className={styles.muted}>Keep this tab open while you're live. Closing it stops your stream.</p>
          </>
        )}
      </div>
    </div>
  );
}
