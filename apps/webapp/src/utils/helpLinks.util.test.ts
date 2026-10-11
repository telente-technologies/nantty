import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSameSiteHelpHref } from "./helpLinks.util";

describe("help article links", () => {
  it("keeps same-site paths", () => {
    assert.equal(isSameSiteHelpHref("/help/payments/refunds"), true);
    assert.equal(isSameSiteHelpHref("/settings?tab=security"), true);
  });

  it("refuses protocol-relative and backslash hosts that leave the site", () => {
    for (const href of ["//evil.example/login", "/\\evil.example", "/path\\..\\x", "https://evil.example", "javascript:alert(1)", "/ spaced"]) {
      assert.equal(isSameSiteHelpHref(href), false, href);
    }
  });
});
