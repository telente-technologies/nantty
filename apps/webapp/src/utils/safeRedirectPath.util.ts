export function readSafeRelativeRedirectPath(candidate: string | null, fallbackPath: string): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\") || candidate.startsWith("/bff")) return fallbackPath;
  return candidate;
}
