"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MediaPermission = "idle" | "requesting" | "granted" | "denied" | "unavailable";

export interface DeviceOption {
  readonly id: string;
  readonly label: string;
}

export interface BroadcastMedia {
  readonly stream: MediaStream | null;
  readonly permission: MediaPermission;
  readonly problem: string | null;
  readonly cameras: readonly DeviceOption[];
  readonly microphones: readonly DeviceOption[];
  readonly cameraId: string;
  readonly microphoneId: string;
  readonly cameraOn: boolean;
  readonly microphoneOn: boolean;
  readonly screenSharing: boolean;
  readonly requestAccess: () => Promise<void>;
  readonly chooseCamera: (deviceId: string) => Promise<void>;
  readonly chooseMicrophone: (deviceId: string) => Promise<void>;
  readonly toggleCamera: () => void;
  readonly toggleMicrophone: () => void;
  readonly toggleScreenShare: () => Promise<void>;
  readonly release: () => void;
}

type TrackListener = (kind: "audio" | "video", track: MediaStreamTrack | null) => void;

const VIDEO_CONSTRAINTS: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };

export function describeMediaError(error: unknown): { permission: MediaPermission; message: string } {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return { permission: "denied", message: "Camera and microphone access is blocked. Allow it from the camera icon in your browser's address bar, then try again." };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return { permission: "unavailable", message: "We couldn't find a camera or microphone. Plug one in, or stream with OBS instead." };
  if (name === "NotReadableError" || name === "AbortError") return { permission: "unavailable", message: "Your camera or microphone is being used by another app. Close it and try again." };
  return { permission: "unavailable", message: "This browser can't use your camera. Try a recent Chrome, Edge, Firefox or Safari." };
}

const toOptions = (devices: readonly MediaDeviceInfo[], kind: MediaDeviceKind, fallback: string): DeviceOption[] =>
  devices.filter((device) => device.kind === kind && device.deviceId).map((device, index) => ({ id: device.deviceId, label: device.label || `${fallback} ${index + 1}` }));

export function useBroadcastMedia(onTrackChange: TrackListener): BroadcastMedia {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permission, setPermission] = useState<MediaPermission>("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [microphones, setMicrophones] = useState<DeviceOption[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [microphoneId, setMicrophoneId] = useState("");
  const [cameraOn, setCameraOn] = useState(true);
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const listenerRef = useRef(onTrackChange);
  const stateRef = useRef({ cameraOn: true, microphoneOn: true });

  useEffect(() => {
    listenerRef.current = onTrackChange;
    stateRef.current = { cameraOn, microphoneOn };
  }, [onTrackChange, cameraOn, microphoneOn]);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    setCameras(toOptions(devices, "videoinput", "Camera"));
    setMicrophones(toOptions(devices, "audioinput", "Microphone"));
  }, []);

  const swapTrack = useCallback((kind: "audio" | "video", track: MediaStreamTrack) => {
    const current = streamRef.current ?? new MediaStream();
    for (const old of kind === "audio" ? current.getAudioTracks() : current.getVideoTracks()) {
      current.removeTrack(old);
      if (old !== screenTrackRef.current && old !== cameraTrackRef.current && old !== track) old.stop();
    }
    track.enabled = kind === "audio" ? stateRef.current.microphoneOn : stateRef.current.cameraOn || track === screenTrackRef.current;
    current.addTrack(track);
    streamRef.current = current;
    setStream(new MediaStream(current.getTracks()));
    listenerRef.current(kind, track);
  }, []);

  const watchForUnplug = useCallback((track: MediaStreamTrack, kind: "audio" | "video") => {
    track.addEventListener("ended", () => {
      if (track === screenTrackRef.current) return;
      setProblem(kind === "video" ? "Your camera was disconnected. Pick another camera below." : "Your microphone was disconnected. Pick another microphone below.");
      if (kind === "video") cameraTrackRef.current = null;
      void refreshDevices();
    });
  }, [refreshDevices]);

  const openDevice = useCallback(async (kind: "audio" | "video", deviceId: string) => {
    const constraints: MediaStreamConstraints = kind === "video"
      ? { video: { ...VIDEO_CONSTRAINTS, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } }
      : { audio: { echoCancellation: true, noiseSuppression: true, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } };
    const opened = await navigator.mediaDevices.getUserMedia(constraints);
    const track = (kind === "video" ? opened.getVideoTracks() : opened.getAudioTracks())[0];
    if (!track) throw new DOMException("No track", "NotFoundError");
    watchForUnplug(track, kind);
    return track;
  }, [watchForUnplug]);

  const requestAccess = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission("unavailable");
      setProblem(describeMediaError(null).message);
      return;
    }
    setPermission("requesting");
    setProblem(null);
    try {
      const opened = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS, audio: { echoCancellation: true, noiseSuppression: true } });
      const video = opened.getVideoTracks()[0] ?? null;
      const audio = opened.getAudioTracks()[0] ?? null;
      if (video) watchForUnplug(video, "video");
      if (audio) watchForUnplug(audio, "audio");
      streamRef.current = opened;
      cameraTrackRef.current = video;
      setStream(opened);
      setCameraId(video?.getSettings().deviceId ?? "");
      setMicrophoneId(audio?.getSettings().deviceId ?? "");
      setPermission("granted");
      await refreshDevices();
    } catch (error) {
      const described = describeMediaError(error);
      setPermission(described.permission);
      setProblem(described.message);
    }
  }, [refreshDevices, watchForUnplug]);

  const chooseCamera = useCallback(async (deviceId: string) => {
    try {
      const track = await openDevice("video", deviceId);
      const previous = cameraTrackRef.current;
      cameraTrackRef.current = track;
      if (previous && previous !== track) previous.stop();
      setCameraId(deviceId);
      setProblem(null);
      if (!screenTrackRef.current) swapTrack("video", track);
    } catch (error) {
      setProblem(describeMediaError(error).message);
    }
  }, [openDevice, swapTrack]);

  const chooseMicrophone = useCallback(async (deviceId: string) => {
    try {
      const track = await openDevice("audio", deviceId);
      setMicrophoneId(deviceId);
      setProblem(null);
      swapTrack("audio", track);
    } catch (error) {
      setProblem(describeMediaError(error).message);
    }
  }, [openDevice, swapTrack]);

  const toggleCamera = useCallback(() => {
    const next = !stateRef.current.cameraOn;
    stateRef.current = { ...stateRef.current, cameraOn: next };
    if (cameraTrackRef.current) cameraTrackRef.current.enabled = next;
    setCameraOn(next);
  }, []);

  const toggleMicrophone = useCallback(() => {
    const next = !stateRef.current.microphoneOn;
    stateRef.current = { ...stateRef.current, microphoneOn: next };
    for (const track of streamRef.current?.getAudioTracks() ?? []) track.enabled = next;
    setMicrophoneOn(next);
  }, []);

  const stopScreenShare = useCallback(() => {
    const screen = screenTrackRef.current;
    screenTrackRef.current = null;
    setScreenSharing(false);
    screen?.stop();
    if (cameraTrackRef.current) swapTrack("video", cameraTrackRef.current);
  }, [swapTrack]);

  const toggleScreenShare = useCallback(async () => {
    if (screenTrackRef.current) {
      stopScreenShare();
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setProblem("Screen sharing isn't supported in this browser.");
      return;
    }
    try {
      const shared = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: false });
      const track = shared.getVideoTracks()[0];
      if (!track) return;
      track.addEventListener("ended", () => {
        if (screenTrackRef.current === track) stopScreenShare();
      });
      screenTrackRef.current = track;
      setScreenSharing(true);
      swapTrack("video", track);
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") return;
      setProblem("We couldn't share your screen. Try again.");
    }
  }, [stopScreenShare, swapTrack]);

  const release = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    cameraTrackRef.current?.stop();
    screenTrackRef.current?.stop();
    streamRef.current = null;
    cameraTrackRef.current = null;
    screenTrackRef.current = null;
    setStream(null);
    setScreenSharing(false);
    setPermission("idle");
  }, []);

  useEffect(() => {
    const mediaDevices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) return;
    const onChange = () => void refreshDevices();
    mediaDevices.addEventListener("devicechange", onChange);
    return () => mediaDevices.removeEventListener("devicechange", onChange);
  }, [refreshDevices]);

  useEffect(() => release, [release]);

  return {
    stream, permission, problem, cameras, microphones, cameraId, microphoneId, cameraOn, microphoneOn, screenSharing,
    requestAccess, chooseCamera, chooseMicrophone, toggleCamera, toggleMicrophone, toggleScreenShare, release,
  };
}
