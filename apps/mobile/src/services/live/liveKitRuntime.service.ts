import type { Room, RoomOptions } from "livekit-client";

import { shouldUseMockForPath } from "@/config/api.config";

import { detectLiveHostingSupport } from "./liveHostingSupport.service";
import { liveVideoProfile } from "./liveMediaPolicy.util";

type LiveKitClient = typeof import("livekit-client");
type LiveKitNative = typeof import("@livekit/react-native");

export interface LiveKitRuntime {
  readonly client: LiveKitClient;
  readonly native: LiveKitNative;
  createRoom(): Room;
}

let cachedRuntime: LiveKitRuntime | null | undefined;

function buildRoomOptions(client: LiveKitClient): RoomOptions {
  const { capture, topLayer, simulcastLayers, audioMaxBitrate } = liveVideoProfile;
  return {
    adaptiveStream: { pixelDensity: "screen" },
    dynacast: true,
    videoCaptureDefaults: { facingMode: "user", resolution: { width: capture.width, height: capture.height, frameRate: capture.frameRate } },
    publishDefaults: {
      simulcast: true,
      videoEncoding: topLayer,
      videoSimulcastLayers: simulcastLayers.map((layer) => new client.VideoPreset(layer.width, layer.height, layer.maxBitrate, layer.maxFramerate)),
      audioPreset: { maxBitrate: audioMaxBitrate },
      dtx: true,
      red: true,
      degradationPreference: "balanced",
    },
    disconnectOnPageLeave: false,
  };
}

export function isLiveVideoPreviewOnly(): boolean {
  return shouldUseMockForPath("/api/v1/lives") || detectLiveHostingSupport() !== "ready";
}

// The native modules are required only here, after the build is known to contain them, so Expo Go never loads them.
export function loadLiveKitRuntime(): LiveKitRuntime | null {
  if (cachedRuntime !== undefined) return cachedRuntime;
  if (isLiveVideoPreviewOnly()) {
    cachedRuntime = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const native = require("@livekit/react-native") as LiveKitNative;
    native.registerGlobals();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const client = require("livekit-client") as LiveKitClient;
    cachedRuntime = { client, native, createRoom: () => new client.Room(buildRoomOptions(client)) };
  } catch {
    cachedRuntime = null;
  }
  return cachedRuntime;
}
