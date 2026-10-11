import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildContentSecurityPolicyHeaderValue, readLiveKitOrigins } from "../server/contentSecurityPolicy.service";

describe("runtime content security policy", () => {
  it("allows only the configured LiveKit host", () => {
    assert.deepEqual(readLiveKitOrigins("wss://livekit.staging.zudomart.com"), ["wss://livekit.staging.zudomart.com", "https://livekit.staging.zudomart.com"]);
    assert.deepEqual(readLiveKitOrigins("ws://192.168.1.20:7880"), ["ws://192.168.1.20:7880", "http://192.168.1.20:7880"]);
    assert.ok(readLiveKitOrigins("wss://zudo.livekit.cloud").includes("wss://*.livekit.cloud"));
  });

  it("fails safe when LiveKit is unset or malformed", () => {
    assert.deepEqual(readLiveKitOrigins(undefined), []);
    assert.deepEqual(readLiveKitOrigins("not a url"), []);
    assert.deepEqual(readLiveKitOrigins("javascript:alert(1)"), []);
  });

  it("reads the env when the request arrives, not when the module loads", () => {
    const previous = process.env.WEBAPP_LIVEKIT_URL;
    process.env.WEBAPP_LIVEKIT_URL = "wss://livekit.prod.zudomart.com";
    assert.match(buildContentSecurityPolicyHeaderValue(), /connect-src [^;]*wss:\/\/livekit\.prod\.zudomart\.com/);
    process.env.WEBAPP_LIVEKIT_URL = "";
    assert.doesNotMatch(buildContentSecurityPolicyHeaderValue(), /livekit/);
    if (previous === undefined) delete process.env.WEBAPP_LIVEKIT_URL;
    else process.env.WEBAPP_LIVEKIT_URL = previous;
  });

  it("adds Smile ID only on the verification page", () => {
    assert.match(buildContentSecurityPolicyHeaderValue({ isIdentityVerification: true }), /smileidentity/);
    assert.doesNotMatch(buildContentSecurityPolicyHeaderValue(), /smileidentity/);
  });
});
