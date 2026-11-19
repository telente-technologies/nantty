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
});
