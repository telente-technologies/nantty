import { create } from "zustand";

import type { CurrencyCode, ViewerLocale } from "@/types";
import { detectDeviceRegionCode } from "@/utils/deviceRegion.util";

const FALLBACK_CURRENCY: CurrencyCode = "USD";

interface LocaleState extends ViewerLocale {
  readonly deviceRegionCode: string | null;
  readonly applyViewerLocaleFromServer: (locale: ViewerLocale) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  deviceRegionCode: detectDeviceRegionCode(),
  countryCode: null,
  currency: FALLBACK_CURRENCY,
  isCountrySupported: false,
  applyViewerLocaleFromServer: (locale) => set(locale),
}));
