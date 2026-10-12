import { shouldUseSecureHostPrefixedCookies } from "@/config/studioEnvironment.config";

const developmentCookieNamePrefix = "zd_studio_";

function prefixCookieNameForHost(baseName: string): string {
  return shouldUseSecureHostPrefixedCookies() ? `__Host-${baseName}` : baseName.replace("zd_", developmentCookieNamePrefix);
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
  get viewer() {
    return prefixCookieNameForHost("zd_viewer");
  },
  get realtimeTicket() {
    return prefixCookieNameForHost("zd_rtt");
  },
};

export const sessionLifetimesInSeconds = {
  accessToken: 15 * 60,
  refreshToken: 30 * 24 * 60 * 60,
  session: 30 * 24 * 60 * 60,
  viewerCache: 5 * 60,
};

export interface HardenedCookieOptions {
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: "lax";
  readonly path: "/";
  readonly maxAge: number;
}

export function buildHardenedCookieOptions(maxAgeInSeconds: number): HardenedCookieOptions {
  return { httpOnly: true, secure: shouldUseSecureHostPrefixedCookies(), sameSite: "lax", path: "/", maxAge: maxAgeInSeconds };
}
