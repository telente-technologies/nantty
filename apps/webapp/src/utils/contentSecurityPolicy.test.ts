import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildContentSecurityPolicyHeaderValue, readLiveKitOrigins } from "../server/contentSecurityPolicy.service";
import { buildIdentityPermissionsPolicyHeaderValue } from "../server/identityPermissionsPolicy.service";

describe("runtime content security policy", () => {
  it("allows only the configured LiveKit host", () => {
    assert.deepEqual(readLiveKitOrigins("wss://livekit.staging.nantty.com"), ["wss://livekit.staging.nantty.com", "https://livekit.staging.nantty.com"]);
    assert.deepEqual(readLiveKitOrigins("ws://192.168.1.20:7880"), ["ws://192.168.1.20:7880", "http://192.168.1.20:7880"]);
    assert.ok(readLiveKitOrigins("wss://nantty.livekit.cloud").includes("wss://*.livekit.cloud"));
  });

  it("fails safe when LiveKit is unset or malformed", () => {
    assert.deepEqual(readLiveKitOrigins(undefined), []);
    assert.deepEqual(readLiveKitOrigins("not a url"), []);
    assert.deepEqual(readLiveKitOrigins("javascript:alert(1)"), []);
  });

  it("reads the env when the request arrives, not when the module loads", () => {
    const previous = process.env.WEBAPP_LIVEKIT_URL;
    process.env.WEBAPP_LIVEKIT_URL = "wss://livekit.prod.nantty.com";
    assert.match(buildContentSecurityPolicyHeaderValue(), /connect-src [^;]*wss:\/\/livekit\.prod\.nantty\.com/);
    process.env.WEBAPP_LIVEKIT_URL = "";
    assert.doesNotMatch(buildContentSecurityPolicyHeaderValue(), /livekit/);
    if (previous === undefined) delete process.env.WEBAPP_LIVEKIT_URL;
    else process.env.WEBAPP_LIVEKIT_URL = previous;
  });

  it("adds Smile ID only on the verification page", () => {
    assert.match(buildContentSecurityPolicyHeaderValue({ isIdentityVerification: true }), /smileidentity/);
    assert.doesNotMatch(buildContentSecurityPolicyHeaderValue(), /smileidentity/);
  });

  it("delegates camera access to Smile ID capture frames, not just its script CDN", () => {
    const policy = buildIdentityPermissionsPolicyHeaderValue();
    assert.match(policy, /camera=\(self "https:\/\/links\.usesmileid\.com"/);
    assert.match(policy, /"https:\/\/links\.sandbox\.usesmileid\.com"/);
    assert.match(policy, /"https:\/\/links\.dev\.usesmileid\.com"/);
    assert.doesNotMatch(policy, /cdn\.usesmileid\.com/);
    assert.match(policy, /microphone=\(\), geolocation=\(\), payment=\(\)/);
  });

  it("allows only the configured first-party social sign-in SDK origins", () => {
    const policy = buildContentSecurityPolicyHeaderValue();
    assert.match(policy, /script-src [^;]*https:\/\/accounts\.google\.com/);
    assert.match(policy, /script-src [^;]*https:\/\/appleid\.cdn-apple\.com/);
    assert.match(policy, /frame-src [^;]*https:\/\/appleid\.apple\.com/);
    assert.match(policy, /connect-src [^;]*https:\/\/accounts\.google\.com/);
  });
});
