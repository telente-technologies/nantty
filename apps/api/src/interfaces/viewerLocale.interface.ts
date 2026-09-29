import type { CurrencyCode } from "../enums/currency.enum.js";

export type ViewerLocaleSource = "saved_preference" | "trusted_proxy_header" | "ip_geolocation" | "client_region_hint" | "unknown";

export interface ViewerLocale {
  readonly countryCode: string | null;
  readonly currency: CurrencyCode;
  readonly isCountrySupported: boolean;
  readonly source: ViewerLocaleSource;
}

export interface ViewerLocaleRequest {
  readonly userId: string | undefined;
  readonly remoteAddress: string | undefined;
  readHeader(name: string): string | undefined;
}

export interface ViewerLocaleResolver {
  resolveViewerLocale(request: ViewerLocaleRequest): Promise<ViewerLocale>;
}

export interface IpCountryLookup {
  findCountryCodeForIpAddress(ipAddress: string): Promise<string | null>;
}
