import { create } from "zustand";

import { detectDeviceRegionCode } from "@/utils/deviceRegion.util";
import type { CurrencyCode, ViewerLocale } from "@/types";

interface LocaleState extends ViewerLocale {
  readonly deviceRegionCode: string | null;
  readonly applyViewerLocaleFromServer: (locale: ViewerLocale) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  deviceRegionCode: detectDeviceRegionCode(),
  countryCode: null,
  currency: "USD" as CurrencyCode,
  isCountrySupported: false,
  applyViewerLocaleFromServer: (locale) => set(locale),
}));
