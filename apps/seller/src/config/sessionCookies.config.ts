import { shouldUseSecureHostPrefixedCookies } from "@/config/sellerEnvironment.config";

function prefixCookieNameForHost(baseName: string): string {
  return shouldUseSecureHostPrefixedCookies() ? `__Host-${baseName}` : baseName;
}

export const sessionCookieNames = {
  get accessToken() {
    return prefixCookieNameForHost("zd_at");
  },
  get refreshToken() {
    return prefixCookieNameForHost("zd_rt");
  },
  get sessionId() {
    return prefixCookieNameForHost("zd_sid");
  },
  get sellerAccess() {
    return prefixCookieNameForHost("zd_access");
  },
  get selectedStore() {
    return prefixCookieNameForHost("zd_store");
  },
  get selectedLocation() {
    return prefixCookieNameForHost("zd_location");
  },
  get realtimeTicket() {
    return prefixCookieNameForHost("zd_rtt");
  },
};

export const sessionLifetimesInSeconds = {
  accessToken: 15 * 60,
  refreshToken: 30 * 24 * 60 * 60,
  session: 30 * 24 * 60 * 60,
  sellerAccessCache: 5 * 60,
};

export interface HardenedCookieOptions {
  readonly httpOnly: true;
  readonly secure: true;
  readonly sameSite: "lax";
  readonly path: "/";
  readonly maxAge: number;
}

export function buildHardenedCookieOptions(maxAgeInSeconds: number): HardenedCookieOptions {
  return { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: maxAgeInSeconds };
}
