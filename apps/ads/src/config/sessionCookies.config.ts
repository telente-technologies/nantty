import { shouldUseSecureHostPrefixedCookies } from "@/config/adsEnvironment.config";

function prefixCookieNameForHost(baseName: string): string {
  return shouldUseSecureHostPrefixedCookies() ? `__Host-${baseName}` : baseName;
}

export const sessionCookieNames = {
  get accessToken() {
    return prefixCookieNameForHost("zda_at");
  },
  get refreshToken() {
    return prefixCookieNameForHost("zda_rt");
  },
  get sessionId() {
    return prefixCookieNameForHost("zda_sid");
  },
  get sessionView() {
    return prefixCookieNameForHost("zda_view");
  },
};

export const sessionLifetimesInSeconds = {
  accessToken: 15 * 60,
  refreshToken: 30 * 24 * 60 * 60,
  session: 30 * 24 * 60 * 60,
  sessionViewCache: 5 * 60,
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
