"use client";
import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import type { SpaceGrant } from "@/services/spaces.service";
export function useSpaceAudio(grant: SpaceGrant | null) {
  const room = useRef<Room | null>(null);
  const [status, setStatus] = useState("idle");
  const [muted, setMuted] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!grant) {
      setStatus("idle");
      return;
    }
    if (grant.demo) {
      setStatus("demo");
      return;
    }
    let disposed = false;
    const current = new Room({ adaptiveStream: true });
    const elements = new Set<HTMLMediaElement>();
    room.current = current;
    setStatus("connecting");
    setMuted(true);
    current.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== Track.Kind.Audio || disposed) return;
      const element = track.attach();
      elements.add(element);
      document.body.appendChild(element);
      void element.play().catch(() => setStatus("playback"));
    });
    current.on(RoomEvent.TrackUnsubscribed, (track) =>
      track.detach().forEach((element) => {
        elements.delete(element);
        element.remove();
      }),
    );
    current.on(RoomEvent.Reconnecting, () => setStatus("reconnecting"));
    current.on(RoomEvent.Reconnected, () => setStatus("connected"));
    current.on(RoomEvent.Disconnected, () => {
      if (!disposed) setStatus("disconnected");
    });
    void current
      .connect(grant.url, grant.token)
      .then(() => {
        if (!disposed) setStatus("connected");
      })
      .catch(() => {
        if (!disposed) setStatus("failed");
      });
    return () => {
      disposed = true;
      current.removeAllListeners();
      void current.disconnect();
      elements.forEach((element) => element.remove());
      if (room.current === current) room.current = null;
    };
  }, [grant, attempt]);
  return {
    status,
    muted,
    retry: () => setAttempt((value) => value + 1),
    resume: async () => {
      await room.current?.startAudio();
      setStatus("connected");
    },
    toggle: async () => {
      if (!grant?.canPublish || !["host", "speaker"].includes(grant.role))
        return;
      await room.current?.localParticipant.setMicrophoneEnabled(muted);
      setMuted(!muted);
    },
  };
}
