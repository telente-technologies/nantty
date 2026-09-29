import { shouldUseSecureHostPrefixedCookies } from "@/config/adminEnvironment.config";

function prefixCookieNameForHost(baseName: string): string {
  return shouldUseSecureHostPrefixedCookies() ? `__Host-${baseName}` : baseName;
}

export const sessionCookieNames = {
  get accessToken() {
    return prefixCookieNameForHost("zadm_at");
  },
  get refreshToken() {
    return prefixCookieNameForHost("zadm_rt");
  },
  get session() {
    return prefixCookieNameForHost("zadm_sid");
  },
  get sessionView() {
    return prefixCookieNameForHost("zadm_view");
  },
  get pendingMfa() {
    return prefixCookieNameForHost("zadm_mfa");
  },
  get stepUp() {
    return prefixCookieNameForHost("zadm_stepup");
  },
};

export const sessionLifetimesInSeconds = {
  accessToken: 10 * 60,
  refreshToken: 12 * 60 * 60,
  absoluteSession: 12 * 60 * 60,
  idle: 15 * 60,
  idleWarningBeforeEnd: 2 * 60,
  sessionViewFreshness: 5 * 60,
  pendingMfa: 5 * 60,
  stepUp: 5 * 60,
};

export interface HardenedCookieOptions {
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: "strict";
  readonly path: "/";
  readonly maxAge: number;
}

export function buildHardenedCookieOptions(maxAgeInSeconds: number): HardenedCookieOptions {
  return { httpOnly: true, secure: shouldUseSecureHostPrefixedCookies(), sameSite: "strict", path: "/", maxAge: maxAgeInSeconds };
}
