const developmentApiBaseUrl = "http://localhost:3000";

export function readPublicApiBaseUrl(): string | null {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (configuredApiUrl) return configuredApiUrl.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "development") return developmentApiBaseUrl;
  return null;
}
