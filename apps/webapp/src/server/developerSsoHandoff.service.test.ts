import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readVerifiedDeveloperSsoRedirect } from "./developerSsoHandoff.service";

describe("developer SSO browser handoff", () => {
  const callback = "https://developers.nantty.com/api/auth/callback";
  it("accepts only the expected callback and state", () => {
    assert.equal(readVerifiedDeveloperSsoRedirect(`${callback}?code=one&state=two`, callback, "two"), `${callback}?code=one&state=two`);
    assert.equal(readVerifiedDeveloperSsoRedirect(`${callback}?code=one&state=wrong`, callback, "two"), null);
    assert.equal(readVerifiedDeveloperSsoRedirect("https://evil.example/api/auth/callback?code=one&state=two", callback, "two"), null);
    assert.equal(readVerifiedDeveloperSsoRedirect("https://developers.nantty.com/other?code=one&state=two", callback, "two"), null);
  });

  it("allows http only for exact localhost and rejects non-http(s) schemes", () => {
    const localCallback = "http://localhost:3500/api/auth/callback";
    assert.equal(readVerifiedDeveloperSsoRedirect(`${localCallback}?code=one&state=two`, localCallback, "two"), `${localCallback}?code=one&state=two`);
    assert.equal(readVerifiedDeveloperSsoRedirect("ws://localhost:3500/api/auth/callback?code=one&state=two", "ws://localhost:3500/api/auth/callback", "two"), null);
    assert.equal(readVerifiedDeveloperSsoRedirect("ftp://localhost/api/auth/callback?code=one&state=two", "ftp://localhost/api/auth/callback", "two"), null);
    assert.equal(readVerifiedDeveloperSsoRedirect("http://localhost.evil.example/api/auth/callback?code=one&state=two", "http://localhost.evil.example/api/auth/callback", "two"), null);
    assert.equal(readVerifiedDeveloperSsoRedirect("http://127.0.0.1:3500/api/auth/callback?code=one&state=two", "http://127.0.0.1:3500/api/auth/callback", "two"), null);
  });
});
