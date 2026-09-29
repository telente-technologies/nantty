import { findCurrencyForCountry, normalizeCountryCode } from "../../../configs/currency.config.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import type {
  IpCountryLookup,
  ViewerLocale,
  ViewerLocaleRequest,
  ViewerLocaleResolver,
  ViewerLocaleSource,
} from "../../../interfaces/viewerLocale.interface.js";

export const CLIENT_REGION_HINT_HEADER = "x-client-region";

export class LayeredViewerLocaleResolver implements ViewerLocaleResolver {
  public constructor(
    private readonly userDirectory: UserDirectory,
    private readonly trustedCountryHeader: string,
    private readonly ipCountryLookup: IpCountryLookup | undefined,
  ) {}

  public async resolveViewerLocale(request: ViewerLocaleRequest): Promise<ViewerLocale> {
    const saved = request.userId === undefined ? undefined : await this.userDirectory.findUserLocalePreference(request.userId);
    const detected = saved?.countryCode ? { countryCode: saved.countryCode, source: "saved_preference" as const } : await this.detectCountryFromRequest(request);
    const mapped = findCurrencyForCountry(detected.countryCode);
    return {
      countryCode: detected.countryCode,
      currency: saved?.currency ?? mapped.currency,
      isCountrySupported: mapped.isCountrySupported,
      source: saved?.currency && detected.source !== "saved_preference" ? "saved_preference" : detected.source,
    };
  }

  private async detectCountryFromRequest(
    request: ViewerLocaleRequest,
  ): Promise<{ readonly countryCode: string | null; readonly source: ViewerLocaleSource }> {
    const fromTrustedProxy = this.trustedCountryHeader === "" ? null : normalizeCountryCode(request.readHeader(this.trustedCountryHeader));
    if (fromTrustedProxy !== null) return { countryCode: fromTrustedProxy, source: "trusted_proxy_header" };
    const fromIpAddress =
      this.ipCountryLookup === undefined || request.remoteAddress === undefined
        ? null
        : normalizeCountryCode(await this.ipCountryLookup.findCountryCodeForIpAddress(request.remoteAddress).catch(() => null));
    if (fromIpAddress !== null) return { countryCode: fromIpAddress, source: "ip_geolocation" };
    const fromClientHint = normalizeCountryCode(request.readHeader(CLIENT_REGION_HINT_HEADER));
    if (fromClientHint !== null) return { countryCode: fromClientHint, source: "client_region_hint" };
    return { countryCode: null, source: "unknown" };
  }
}
