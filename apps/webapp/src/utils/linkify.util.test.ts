import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normaliseLinkHref, splitTextByUrls } from "./linkify.util";

describe("splitTextByUrls", () => {
  it("returns plain text untouched", () => {
    assert.deepEqual(splitTextByUrls("no links here"), [{ text: "no links here", href: null }]);
  });

  it("links https and www addresses and trims punctuation", () => {
    const segments = splitTextByUrls("Read https://example.com/a. Then www.nantty.com/p/x!");
    assert.deepEqual(segments.filter((segment) => segment.href).map((segment) => segment.href), ["https://example.com/a", "https://www.nantty.com/p/x"]);
    assert.equal(segments.map((segment) => segment.text).join(""), "Read https://example.com/a. Then www.nantty.com/p/x!");
  });

  it("never produces a non-web href", () => {
    assert.equal(normaliseLinkHref("javascript:alert(1)"), null);
    assert.ok(splitTextByUrls("awww.nice").every((segment) => segment.href === null));
  });
});
