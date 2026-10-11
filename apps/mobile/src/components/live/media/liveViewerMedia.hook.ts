import { useCallback, useEffect, useState } from "react";
import type { Participant, RemoteAudioTrack, Track, TrackPublication } from "livekit-client";
import type { TrackReference } from "@livekit/react-native";

import type { LiveRoomConnection } from "./liveRoomConnection.hook";

export interface LiveViewerMedia {
  readonly hostVideo: TrackReference | undefined;
  readonly isAudioMuted: boolean;
  readonly toggleAudio: () => void;
}

function findVideoPublication(participant: Participant, cameraSource: Track.Source): TrackPublication | undefined {
  const camera = participant.getTrackPublication(cameraSource);
  if (camera?.track && !camera.isMuted) return camera;
  return [...participant.videoTrackPublications.values()].find((publication) => publication.track && !publication.isMuted);
}

export function findStreamerVideo(connection: LiveRoomConnection, identity: string | null): TrackReference | undefined {
  const { room, runtime, revision } = connection;
  if (!room || !runtime || revision < 0 || identity === null) return undefined;
  const cameraSource = runtime.client.Track.Source.Camera;
  const participant: Participant | undefined = identity === room.localParticipant.identity ? room.localParticipant : room.remoteParticipants.get(identity);
  const publication = participant ? findVideoPublication(participant, cameraSource) : undefined;
  return participant && publication ? { participant, publication, source: publication.source } : undefined;
}

// Encoder (OBS) lives publish through an ingress participant, so fall back to any remote video when the host has none.
export function useLiveViewerMedia(connection: LiveRoomConnection, hostId: string): LiveViewerMedia {
  const { room, revision } = connection;
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const hostVideo = findStreamerVideo(connection, hostId);
  let fallback: TrackReference | undefined;
  if (!hostVideo && room && connection.runtime) {
    const { ParticipantKind, Track } = connection.runtime.client;
    for (const participant of room.remoteParticipants.values()) {
      if (participant.kind !== ParticipantKind.INGRESS) continue;
      const publication = findVideoPublication(participant, Track.Source.Camera);
      if (publication) {
        fallback = { participant, publication, source: publication.source };
        break;
      }
    }
  }

  useEffect(() => {
    if (!room) return;
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.audioTrackPublications.values()) {
        (publication.track as RemoteAudioTrack | undefined)?.setVolume(isAudioMuted ? 0 : 1);
      }
    }
  }, [room, revision, isAudioMuted]);

  const toggleAudio = useCallback(() => setIsAudioMuted((muted) => !muted), []);
  return { hostVideo: hostVideo ?? fallback, isAudioMuted, toggleAudio };
}
