import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import type { LocalVideoTrack } from "livekit-client";
import type { TrackReference } from "@livekit/react-native";

import type { LiveRoomConnection } from "./liveRoomConnection.hook";

export type CameraFacing = "user" | "environment";

export interface LiveHostMedia {
  readonly isMicOn: boolean;
  readonly isCameraOn: boolean;
  readonly facing: CameraFacing;
  readonly wasPausedInBackground: boolean;
  readonly cameraTrackRef: TrackReference | undefined;
  readonly toggleMic: () => void;
  readonly toggleCamera: () => void;
  readonly flipCamera: () => void;
}

const KEEP_AWAKE_TAG = "zudomart-live-host";
const BACKGROUND_NOTICE_MS = 6_000;

async function requestBluetoothRouting() {
  if (Platform.OS !== "android" || Number(Platform.Version) < 31) return;
  await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT).catch(() => undefined);
}

export function useKeepAwakeWhile(isActive: boolean) {
  useEffect(() => {
    if (!isActive) return undefined;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [isActive]);
}

export function useLiveHostMedia(connection: LiveRoomConnection, isActive: boolean): LiveHostMedia {
  const { room, runtime, status, canPublish, revision } = connection;
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [facing, setFacing] = useState<CameraFacing>("user");
  const [wasPausedInBackground, setWasPausedInBackground] = useState(false);
  const desired = useRef({ isMicOn, isCameraOn, facing });
  useEffect(() => {
    desired.current = { isMicOn, isCameraOn, facing };
  });
  const isPausedForBackground = useRef(false);
  const isPublishing = isActive && status === "connected" && canPublish && room !== null;

  useEffect(() => {
    if (isActive) void requestBluetoothRouting();
  }, [isActive]);

  useEffect(() => {
    if (!isPublishing || !room) return;
    const { isMicOn: mic, isCameraOn: camera, facing: facingMode } = desired.current;
    void room.localParticipant.setCameraEnabled(camera && !isPausedForBackground.current, { facingMode }).catch(() => setIsCameraOn(false));
    void room.localParticipant.setMicrophoneEnabled(mic).catch(() => setIsMicOn(false));
  }, [isPublishing, room]);

  useEffect(() => {
    if (!isPublishing || !room) return undefined;
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" && desired.current.isCameraOn) {
        isPausedForBackground.current = true;
        void room.localParticipant.setCameraEnabled(false).catch(() => undefined);
      }
      if (state === "active" && isPausedForBackground.current) {
        isPausedForBackground.current = false;
        void room.localParticipant.setCameraEnabled(desired.current.isCameraOn, { facingMode: desired.current.facing }).catch(() => undefined);
        setWasPausedInBackground(true);
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => setWasPausedInBackground(false), BACKGROUND_NOTICE_MS);
      }
    });
    return () => {
      subscription.remove();
      clearTimeout(noticeTimer);
    };
  }, [isPublishing, room]);

  const toggleMic = useCallback(() => {
    const next = !desired.current.isMicOn;
    setIsMicOn(next);
    void room?.localParticipant.setMicrophoneEnabled(next).catch(() => setIsMicOn(!next));
  }, [room]);

  const toggleCamera = useCallback(() => {
    const next = !desired.current.isCameraOn;
    setIsCameraOn(next);
    void room?.localParticipant.setCameraEnabled(next, { facingMode: desired.current.facing }).catch(() => setIsCameraOn(!next));
  }, [room]);

  const flipCamera = useCallback(() => {
    if (!room || !runtime) return;
    const next: CameraFacing = desired.current.facing === "user" ? "environment" : "user";
    setFacing(next);
    const track = room.localParticipant.getTrackPublication(runtime.client.Track.Source.Camera)?.track as LocalVideoTrack | undefined;
    void track?.restartTrack({ facingMode: next }).catch(() => setFacing(desired.current.facing === "user" ? "environment" : "user"));
  }, [room, runtime]);

  let cameraTrackRef: TrackReference | undefined;
  if (room && runtime && revision >= 0) {
    const publication = room.localParticipant.getTrackPublication(runtime.client.Track.Source.Camera);
    if (publication?.track && !publication.isMuted) {
      cameraTrackRef = { participant: room.localParticipant, publication, source: runtime.client.Track.Source.Camera };
    }
  }

  return { isMicOn, isCameraOn, facing, wasPausedInBackground, cameraTrackRef, toggleMic, toggleCamera, flipCamera };
}
