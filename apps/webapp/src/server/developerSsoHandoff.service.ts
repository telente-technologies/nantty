export function readVerifiedDeveloperSsoRedirect(location: string | null, redirectUri: string | null, state: string | null): string | null {
  if (!location || !redirectUri || !state) return null;
  try {
    const expected = new URL(redirectUri);
    const actual = new URL(location);
    const isAllowedLocalhostHttp = expected.protocol === "http:" && expected.hostname === "localhost";
    if (expected.protocol !== "https:" && !isAllowedLocalhostHttp) return null;
    if (actual.origin !== expected.origin || actual.pathname !== expected.pathname) return null;
    if (!actual.searchParams.get("code") || actual.searchParams.get("state") !== state) return null;
    for (const [key, value] of expected.searchParams) {
      if (actual.searchParams.get(key) !== value) return null;
    }
    return actual.toString();
  } catch {
    return null;
  }
}
