import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";

import { secureStorage } from "./secureStorage.util";

const PASSCODE_HASH_KEY = "chat.passcode.hash";
const PASSCODE_SALT_KEY = "chat.passcode.salt";
const LOCK_PREFERENCES_KEY = "chat.lock.preferences";

export const MINIMUM_PASSCODE_LENGTH = 4;
export const MAXIMUM_PASSCODE_LENGTH = 6;
export const AUTO_LOCK_OPTIONS_SECONDS = [0, 60, 300, 900, 3600] as const;

export interface ChatLockPreferences {
  readonly biometricsEnabled: boolean;
  readonly autoLockSeconds: number;
}

export const DEFAULT_CHAT_LOCK_PREFERENCES: ChatLockPreferences = { biometricsEnabled: false, autoLockSeconds: 60 };

export const isValidPasscodeFormat = (passcode: string) => new RegExp(`^\\d{${MINIMUM_PASSCODE_LENGTH},${MAXIMUM_PASSCODE_LENGTH}}$`).test(passcode);

const hashPasscode = (salt: string, passcode: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${passcode}`);

export async function saveChatPasscode(passcode: string) {
  const salt = Crypto.randomUUID();
  await secureStorage.set(PASSCODE_SALT_KEY, salt);
  await secureStorage.set(PASSCODE_HASH_KEY, await hashPasscode(salt, passcode));
}

export async function hasChatPasscode() {
  return (await secureStorage.get(PASSCODE_HASH_KEY)) !== null;
}

export async function verifyChatPasscode(passcode: string) {
  const [salt, savedHash] = await Promise.all([secureStorage.get(PASSCODE_SALT_KEY), secureStorage.get(PASSCODE_HASH_KEY)]);
  return !!salt && !!savedHash && (await hashPasscode(salt, passcode)) === savedHash;
}

export async function removeChatPasscodeAndPreferences() {
  await Promise.all([PASSCODE_HASH_KEY, PASSCODE_SALT_KEY, LOCK_PREFERENCES_KEY].map((key) => secureStorage.remove(key)));
}

export async function readChatLockPreferences(): Promise<ChatLockPreferences> {
  try {
    const saved = await secureStorage.get(LOCK_PREFERENCES_KEY);
    return saved ? { ...DEFAULT_CHAT_LOCK_PREFERENCES, ...(JSON.parse(saved) as Partial<ChatLockPreferences>) } : DEFAULT_CHAT_LOCK_PREFERENCES;
  } catch {
    return DEFAULT_CHAT_LOCK_PREFERENCES;
  }
}

export const saveChatLockPreferences = (preferences: ChatLockPreferences) => secureStorage.set(LOCK_PREFERENCES_KEY, JSON.stringify(preferences));

export async function areBiometricsAvailable() {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function authenticateWithBiometrics(promptMessage: string) {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, disableDeviceFallback: true });
    return result.success;
  } catch {
    return false;
  }
}

export const describeAutoLockOption = (seconds: number) =>
  seconds === 0 ? "Immediately" : seconds < 3600 ? `After ${seconds / 60} min` : "After 1 hour";
