import type { SavedCardDisplay, SavedCardOffer } from "@/types/commerce.type";

import { authenticateWithBiometrics, areBiometricsAvailable } from "./chatPasscode.util";
import { secureStorage } from "./secureStorage.util";

const DISPLAY_KEY = "zudomart.paystack.savedCard.display";
const CODE_KEY = "zudomart.paystack.savedCard.code";

export async function readSavedCardDisplay(): Promise<SavedCardDisplay | null> {
  try {
    const raw = await secureStorage.get(DISPLAY_KEY);
    return raw ? (JSON.parse(raw) as SavedCardDisplay) : null;
  } catch {
    return null;
  }
}

export async function saveCardOnThisDevice(offer: SavedCardOffer): Promise<void> {
  const { authorizationCode, ...display } = offer;
  await secureStorage.set(CODE_KEY, authorizationCode);
  await secureStorage.set(DISPLAY_KEY, JSON.stringify(display));
}

export async function removeSavedCardFromThisDevice(): Promise<void> {
  await secureStorage.remove(CODE_KEY);
  await secureStorage.remove(DISPLAY_KEY);
}

export async function unlockSavedCardAuthorizationCode(): Promise<string | null> {
  if (!(await areBiometricsAvailable())) return null;
  if (!(await authenticateWithBiometrics("Confirm to pay with your saved card"))) return null;
  return secureStorage.get(CODE_KEY);
}
