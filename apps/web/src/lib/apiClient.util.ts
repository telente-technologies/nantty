const developmentApiBaseUrl = "http://localhost:3000";
const requestTimeoutInMilliseconds = 10_000;

export interface JsonApiResponse {
  readonly status: number;
  readonly body: unknown;
}

export function readPublicApiBaseUrl(): string | null {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (configuredApiUrl) return configuredApiUrl.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "development") return developmentApiBaseUrl;
  return null;
}

async function readResponseBodyAsJsonIfPossible(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function postJsonToApi(apiPath: string, requestBody: unknown): Promise<JsonApiResponse> {
  const apiBaseUrl = readPublicApiBaseUrl();
  if (!apiBaseUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  const timeoutController = new AbortController();
  const timeoutHandle = setTimeout(() => timeoutController.abort(), requestTimeoutInMilliseconds);
  try {
    const response = await fetch(`${apiBaseUrl}${apiPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(requestBody),
      credentials: "omit",
      signal: timeoutController.signal,
    });
    return { status: response.status, body: await readResponseBodyAsJsonIfPossible(response) };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
