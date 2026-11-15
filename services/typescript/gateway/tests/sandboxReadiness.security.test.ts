import { afterEach, describe, expect, it, vi } from "vitest";

import { getSandboxReadiness } from "../../../../apps/sandbox/src/server/sandboxReadiness.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Sandbox gateway readiness boundary", () => {
  it("does not configure a Sandbox service from an empty origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SANDBOX_API_BASE_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSandboxReadiness()).resolves.toMatchObject({ service: "Sandbox API gateway", state: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects the production API host before sending a readiness request", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SANDBOX_API_BASE_URL", "https://api.nantty.com");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSandboxReadiness()).resolves.toMatchObject({ state: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports ready only when the dedicated test gateway returns an explicit ready state", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SANDBOX_API_BASE_URL", "https://sandbox-api.nantty.com");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: "ready" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSandboxReadiness()).resolves.toMatchObject({ state: "ready" });
    expect(fetchMock).toHaveBeenCalledWith(new URL("https://sandbox-api.nantty.com/readyz"), expect.objectContaining({ cache: "no-store", redirect: "error" }));
  });

  it("does not interpret a generic successful health response as ready", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SANDBOX_API_BASE_URL", "https://control.sandbox.nantty.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "ok" })));

    await expect(getSandboxReadiness()).resolves.toMatchObject({ state: "unavailable" });
  });

  it("rejects oversized readiness payloads", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SANDBOX_API_BASE_URL", "https://sandbox-api.nantty.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ready", padding: "x".repeat(3_000) }))));

    await expect(getSandboxReadiness()).resolves.toMatchObject({ state: "unavailable" });
  });
});
