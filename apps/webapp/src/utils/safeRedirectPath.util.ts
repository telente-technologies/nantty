export function readSafeRelativeRedirectPath(candidate: string | null, fallbackPath: string): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\") || candidate.startsWith("/bff")) return fallbackPath;
  return candidate;
}

export function readDeveloperSsoContinuePath(candidate: string | null): string | null {
  const path = readSafeRelativeRedirectPath(candidate, "");
  if (!path) return null;
  try {
    const parsed = new URL(path, "https://nantty-return.invalid");
    if (parsed.origin !== "https://nantty-return.invalid" || parsed.pathname !== "/api/v1/auth/sso/authorize") return null;
    if (!parsed.searchParams.get("client_id") || !parsed.searchParams.get("redirect_uri") || !parsed.searchParams.get("state")) return null;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}
