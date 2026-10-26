import { Camera } from "expo-camera";
import { Linking } from "react-native";

import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

export type LiveMediaPermissionOutcome = "granted" | "denied";

interface PermissionLike {
  readonly granted: boolean;
  readonly canAskAgain: boolean;
}

async function ensurePermission(read: () => Promise<PermissionLike>, request: () => Promise<PermissionLike>): Promise<boolean> {
  try {
    const current = await read();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await request()).granted;
  } catch {
    return false;
  }
}

export async function ensureLiveCameraAndMicrophone(needsCamera: boolean): Promise<LiveMediaPermissionOutcome> {
  const cameraGranted = needsCamera ? await ensurePermission(() => Camera.getCameraPermissionsAsync(), () => Camera.requestCameraPermissionsAsync()) : true;
  const microphoneGranted = await ensurePermission(() => Camera.getMicrophonePermissionsAsync(), () => Camera.requestMicrophonePermissionsAsync());
  return cameraGranted && microphoneGranted ? "granted" : "denied";
}

export function promptToEnableLiveMediaInSettings(needsCamera: boolean) {
  const devices = needsCamera ? "camera and microphone" : "microphone";
  showAlertWithButtons(`Turn on your ${devices}`, `Nantty needs your ${devices} to go live. You can turn ${needsCamera ? "them" : "it"} on in Settings.`, [
    { text: "Not now", style: "cancel" },
    { text: "Open Settings", onPress: () => void Linking.openSettings().catch(() => undefined) },
  ]);
}
