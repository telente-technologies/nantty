export type SandboxReadinessState = "ready" | "unavailable" | "not_configured";

const allowedHostSuffixes = [".sandbox.nantty.com"];
const maxReadinessBytes = 2_048;

async function readReadinessPayload(response: Response): Promise<{ readonly status?: unknown; readonly ready?: unknown } | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxReadinessBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const payload: unknown = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
  return typeof payload === "object" && payload !== null ? payload as { readonly status?: unknown; readonly ready?: unknown } : null;
}

function readSandboxApiUrl(): URL | null {
  const configured = process.env.SANDBOX_API_BASE_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    const localDevelopment = process.env.NODE_ENV !== "production" && localHost && url.protocol === "http:";
    const dedicatedSandboxHost = url.hostname === "sandbox-api.nantty.com" || allowedHostSuffixes.some((suffix) => url.hostname.endsWith(suffix));
    if (
      (url.protocol !== "https:" && !localDevelopment) ||
      (!localDevelopment && !dedicatedSandboxHost) ||
      url.username || url.password || url.search || url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    ) return null;
    return url;
  } catch {
    return null;
  }
}

export async function getSandboxReadiness(): Promise<{ readonly service: string; readonly state: SandboxReadinessState; readonly checkedAt: string }> {
  const baseUrl = readSandboxApiUrl();
  let state: SandboxReadinessState = baseUrl ? "unavailable" : "not_configured";
  if (baseUrl) {
    try {
      const response = await fetch(new URL("/readyz", baseUrl), {
        headers: { accept: "application/json" },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(1_500),
      });
      if (response.ok) {
        const readiness = await readReadinessPayload(response);
        if (readiness?.status === "ready" || readiness?.ready === true) state = "ready";
      }
    } catch {
      state = "unavailable";
    }
  }
  return { service: "Sandbox API gateway", state, checkedAt: new Date().toISOString() };
}
