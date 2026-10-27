import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readInternalPathFromUrl } from "./postLinks.util";

describe("readInternalPathFromUrl", () => {
  it("keeps ordinary internal paths", () => {
    assert.equal(readInternalPathFromUrl("https://nantty.com/post/abc?x=1#c"), "/post/abc?x=1#c");
    assert.equal(readInternalPathFromUrl("https://web.nantty.com/post/abc?x=1#c"), "/post/abc?x=1#c");
  });

  it("never returns a protocol-relative path that would leave the site", () => {
    assert.equal(readInternalPathFromUrl("https://nantty.com//evil.example/phish"), "/evil.example/phish");
    assert.equal(readInternalPathFromUrl("https://nantty.com/\\evil.example"), "/evil.example");
  });

  it("ignores external hosts", () => {
    assert.equal(readInternalPathFromUrl("https://evil.example/post/abc"), null);
  });
});
