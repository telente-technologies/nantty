import Constants, { ExecutionEnvironment } from "expo-constants";
import { NativeModules, Platform, TurboModuleRegistry } from "react-native";

import { shouldUseMockForPath } from "@/config/api.config";

export type LiveHostingSupport = "ready" | "expoGo" | "noVideoEngine" | "web";

const WEBRTC_NATIVE_MODULE_NAMES = ["WebRTCModule", "LivekitReactNativeModule"] as const;

function isNativeModuleLinked(name: string): boolean {
  try {
    return NativeModules[name] != null || TurboModuleRegistry.get(name) != null;
  } catch {
    return false;
  }
}

export function isRunningInExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

export function detectLiveHostingSupport(): LiveHostingSupport {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return "web";
  if (isRunningInExpoGo()) return "expoGo";
  return WEBRTC_NATIVE_MODULE_NAMES.some(isNativeModuleLinked) ? "ready" : "noVideoEngine";
}

export function canPreviewLiveHostingWithMocks(): boolean {
  return shouldUseMockForPath("/api/v1/lives");
}

export type LiveHostingGateKind = "expoGo" | "web";

export function decideLiveHostingGate(support: LiveHostingSupport, source: "camera" | "screen" | "external", hasAcceptedMockPreview: boolean): LiveHostingGateKind | null {
  if (source === "external" || hasAcceptedMockPreview) return null;
  return support === "expoGo" || support === "web" ? support : null;
}
