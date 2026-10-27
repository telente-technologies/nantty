import { afterEach, describe, expect, it, vi } from "vitest";

import { loadMediaConfigFromEnvironment } from "../../src/configs/media.config.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("media production configuration", () => {
  it("rejects an empty or placeholder internal token", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://svc_media:secret@db/nantty");
    vi.stubEnv("GATEWAY_IDENTITY_SECRET", "g".repeat(48));
    vi.stubEnv("MEDIA_INTERNAL_TOKEN", "");
    expect(() => loadMediaConfigFromEnvironment()).toThrow(/MEDIA_INTERNAL_TOKEN/);

    vi.stubEnv("MEDIA_INTERNAL_TOKEN", "local-only-media-internal-token-0123456789");
    expect(() => loadMediaConfigFromEnvironment()).toThrow(/MEDIA_INTERNAL_TOKEN/);
  });

  it("accepts a long random internal token", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://svc_media:secret@db/nantty");
    vi.stubEnv("GATEWAY_IDENTITY_SECRET", "g".repeat(48));
    vi.stubEnv("MEDIA_INTERNAL_TOKEN", "a".repeat(48));
    expect(loadMediaConfigFromEnvironment().internalToken).toHaveLength(48);
  });
});
