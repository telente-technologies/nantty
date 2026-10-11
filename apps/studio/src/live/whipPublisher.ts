export type ConnectionQuality = "excellent" | "good" | "poor" | "lost" | "connecting";

export interface PublisherStats {
  readonly quality: ConnectionQuality;
  readonly bitrateKbps: number | null;
  readonly packetLossPercent: number | null;
  readonly roundTripMs: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly framesPerSecond: number | null;
}

export interface WhipSession {
  readonly replaceTrack: (kind: "audio" | "video", track: MediaStreamTrack | null) => Promise<void>;
  readonly readStats: () => Promise<PublisherStats>;
  readonly onStateChange: (listener: (state: RTCPeerConnectionState) => void) => () => void;
  readonly stop: () => Promise<void>;
}

export class WhipPublishError extends Error {
  public constructor(public readonly code: "INGEST_REJECTED" | "INGEST_UNREACHABLE" | "BROWSER_UNSUPPORTED", message: string) {
    super(message);
    this.name = "WhipPublishError";
  }
}

const SIMULATED_INGEST_PREFIX = "mock:";
const ICE_GATHERING_TIMEOUT_MS = 2500;
const MAX_VIDEO_BITRATE = 3_500_000;

export const isSimulatedIngest = (ingestUrl: string) => ingestUrl.startsWith(SIMULATED_INGEST_PREFIX);

export function describeQuality(stats: Pick<PublisherStats, "bitrateKbps" | "packetLossPercent" | "roundTripMs">): ConnectionQuality {
  const loss = stats.packetLossPercent ?? 0;
  const roundTrip = stats.roundTripMs ?? 0;
  if (stats.bitrateKbps !== null && stats.bitrateKbps < 150) return "poor";
  if (loss > 5 || roundTrip > 400) return "poor";
  if (loss > 1.5 || roundTrip > 180) return "good";
  return "excellent";
}

function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setTimeout(done, ICE_GATHERING_TIMEOUT_MS);
    function done() {
      window.clearTimeout(timer);
      peer.removeEventListener("icegatheringstatechange", check);
      resolve();
    }
    function check() {
      if (peer.iceGatheringState === "complete") done();
    }
    peer.addEventListener("icegatheringstatechange", check);
  });
}

function createSimulatedSession(): WhipSession {
  const listeners = new Set<(state: RTCPeerConnectionState) => void>();
  return {
    replaceTrack: async () => undefined,
    readStats: async () => ({ quality: "excellent", bitrateKbps: 2400 + Math.round(Math.random() * 300), packetLossPercent: 0, roundTripMs: 42, width: 1280, height: 720, framesPerSecond: 30 }),
    onStateChange: (listener) => {
      listeners.add(listener);
      listener("connected");
      return () => listeners.delete(listener);
    },
    stop: async () => listeners.clear(),
  };
}

export async function publishOverWhip(ingestUrl: string, streamKey: string, stream: MediaStream): Promise<WhipSession> {
  if (isSimulatedIngest(ingestUrl)) return createSimulatedSession();
  if (typeof RTCPeerConnection === "undefined") throw new WhipPublishError("BROWSER_UNSUPPORTED", "This browser can't stream. Use a recent Chrome, Edge, Firefox or Safari, or stream with OBS.");
  const peer = new RTCPeerConnection({ bundlePolicy: "max-bundle" });
  const audioTrack = stream.getAudioTracks()[0] ?? null;
  const videoTrack = stream.getVideoTracks()[0] ?? null;
  const audio = audioTrack ? peer.addTransceiver(audioTrack, { direction: "sendonly", streams: [stream] }) : peer.addTransceiver("audio", { direction: "sendonly" });
  const video = videoTrack
    ? peer.addTransceiver(videoTrack, { direction: "sendonly", streams: [stream], sendEncodings: [{ maxBitrate: MAX_VIDEO_BITRATE }] })
    : peer.addTransceiver("video", { direction: "sendonly" });

  let resourceUrl: string | null = null;
  try {
    await peer.setLocalDescription(await peer.createOffer());
    await waitForIceGathering(peer);
    let response: Response;
    try {
      response = await fetch(ingestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp", Authorization: `Bearer ${streamKey}` },
        body: peer.localDescription?.sdp ?? "",
      });
    } catch {
      throw new WhipPublishError("INGEST_UNREACHABLE", "We couldn't reach the live server. Check your connection and try again.");
    }
    if (!response.ok) throw new WhipPublishError("INGEST_REJECTED", "The live server didn't accept the stream. Try again in a moment.");
    const location = response.headers.get("location");
    resourceUrl = location ? new URL(location, ingestUrl).toString() : null;
    await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
  } catch (error) {
    peer.close();
    throw error;
  }

  let previous: { bytes: number; at: number } | null = null;
  return {
    replaceTrack: async (kind, track) => {
      await (kind === "audio" ? audio : video).sender.replaceTrack(track);
    },
    readStats: async () => {
      const report = await peer.getStats();
      let bytes = 0;
      let width: number | null = null;
      let height: number | null = null;
      let framesPerSecond: number | null = null;
      let lost = 0;
      let received = 0;
      let roundTrip: number | null = null;
      report.forEach((entry: Record<string, unknown>) => {
        if (entry.type === "outbound-rtp") {
          bytes += Number(entry.bytesSent ?? 0);
          if (entry.kind === "video") {
            width = typeof entry.frameWidth === "number" ? entry.frameWidth : width;
            height = typeof entry.frameHeight === "number" ? entry.frameHeight : height;
            framesPerSecond = typeof entry.framesPerSecond === "number" ? entry.framesPerSecond : framesPerSecond;
          }
        }
        if (entry.type === "remote-inbound-rtp") {
          lost += Number(entry.packetsLost ?? 0);
          received += Number(entry.packetsReceived ?? 0);
          if (typeof entry.roundTripTime === "number") roundTrip = Math.max(roundTrip ?? 0, entry.roundTripTime * 1000);
        }
        if (entry.type === "candidate-pair" && entry.nominated === true && typeof entry.currentRoundTripTime === "number" && roundTrip === null) {
          roundTrip = entry.currentRoundTripTime * 1000;
        }
      });
      const now = performance.now();
      const bitrateKbps = previous && now > previous.at ? Math.max(0, Math.round(((bytes - previous.bytes) * 8) / (now - previous.at))) : null;
      previous = { bytes, at: now };
      const packetLossPercent = lost + received > 0 ? Math.round((lost / (lost + received)) * 1000) / 10 : null;
      const roundTripMs = roundTrip === null ? null : Math.round(roundTrip);
      const state = peer.connectionState;
      const quality: ConnectionQuality = state === "failed" || state === "disconnected" || state === "closed" ? "lost" : state === "connected" ? describeQuality({ bitrateKbps, packetLossPercent, roundTripMs }) : "connecting";
      return { quality, bitrateKbps, packetLossPercent, roundTripMs, width, height, framesPerSecond };
    },
    onStateChange: (listener) => {
      const notify = () => listener(peer.connectionState);
      peer.addEventListener("connectionstatechange", notify);
      notify();
      return () => peer.removeEventListener("connectionstatechange", notify);
    },
    stop: async () => {
      peer.close();
      if (resourceUrl) {
        await fetch(resourceUrl, { method: "DELETE", headers: { Authorization: `Bearer ${streamKey}` }, keepalive: true }).catch(() => undefined);
      }
    },
  };
}
