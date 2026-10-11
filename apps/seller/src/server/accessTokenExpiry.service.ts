// Reads the exp claim of a JWT access token without verifying it (the gateway verifies). Used only to avoid
// forwarding a token we already know is expired: refresh first instead of sending it.
const expirySkewSeconds = 10;

export function readAccessTokenExpiryInEpochSeconds(accessToken: string): number | null {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  try {
    const exp = (JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown }).exp;
    return typeof exp === "number" && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

export function isAccessTokenKnownExpired(accessToken: string | null, nowInEpochSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!accessToken) return false;
  const exp = readAccessTokenExpiryInEpochSeconds(accessToken);
  return exp !== null && exp <= nowInEpochSeconds + expirySkewSeconds;
}
