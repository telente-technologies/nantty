import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ReadinessState = "ready" | "unavailable" | "not_configured";

function readGatewayUrl(): URL | undefined {
  const value = process.env.DEVELOPER_API_BASE_URL?.trim();
  if (!value) return undefined;

  try {
    const url = new URL(value);
    const localHttp = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(url.protocol === "http:" && localHttp)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

export async function GET() {
  const baseUrl = readGatewayUrl();
  let state: ReadinessState = baseUrl ? "unavailable" : "not_configured";

  if (baseUrl) {
    try {
      const readinessUrl = new URL("/readyz", baseUrl);
      const response = await fetch(readinessUrl, {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(1_500),
        headers: { accept: "application/json" },
      });
      if (response.ok) {
        const payload: unknown = await response.json();
        if (typeof payload === "object" && payload !== null) {
          const result = payload as { status?: unknown; ready?: unknown };
          if (result.status === "ready" || result.ready === true) state = "ready";
        }
      }
    } catch {
      state = "unavailable";
    }
  }

  return NextResponse.json(
    { service: "Nantty API gateway", state, checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
