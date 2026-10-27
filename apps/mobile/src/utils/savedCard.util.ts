import type { SavedCardDisplay, SavedCardOffer } from "@/types/commerce.type";

import { authenticateWithBiometrics, areBiometricsAvailable } from "./chatPasscode.util";
import { secureStorage } from "./secureStorage.util";

const DISPLAY_KEY = "nantty.savedCard.display";
const CARD_ID_KEY = "nantty.savedCard.id";
const LEGACY_CODE_KEY = "nantty.savedCard.legacyCode";

export async function readSavedCardDisplay(): Promise<SavedCardDisplay | null> {
  try {
    const raw = await secureStorage.get(DISPLAY_KEY);
    return raw ? (JSON.parse(raw) as SavedCardDisplay) : null;
  } catch {
    return null;
  }
}

export async function saveCardOnThisDevice(offer: SavedCardOffer): Promise<void> {
  const { savedCardId, ...display } = offer;
  await secureStorage.remove(LEGACY_CODE_KEY);
  await secureStorage.set(CARD_ID_KEY, savedCardId);
  await secureStorage.set(DISPLAY_KEY, JSON.stringify(display));
}

export async function removeSavedCardFromThisDevice(): Promise<void> {
  await secureStorage.remove(CARD_ID_KEY);
  await secureStorage.remove(LEGACY_CODE_KEY);
  await secureStorage.remove(DISPLAY_KEY);
}

export async function unlockSavedCardId(): Promise<string | null> {
  if (!(await areBiometricsAvailable())) return null;
  if (!(await authenticateWithBiometrics("Confirm to pay with your saved card"))) return null;
  return secureStorage.get(CARD_ID_KEY);
}
