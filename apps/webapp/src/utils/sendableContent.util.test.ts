import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasSendableContent } from "./sendableContent.util";

describe("hasSendableContent", () => {
  it("rejects empty and missing text", () => {
    assert.equal(hasSendableContent(""), false);
    assert.equal(hasSendableContent(null), false);
    assert.equal(hasSendableContent(undefined), false);
  });

  it("rejects whitespace-only text", () => {
    assert.equal(hasSendableContent(" \t\n  "), false);
  });

  it("rejects no-break and ideographic spaces", () => {
    assert.equal(hasSendableContent(" 　"), false);
  });

  it("rejects zero-width and directional formatting characters only", () => {
    assert.equal(hasSendableContent("⁠⁣⁤"), false);
  });

  it("accepts a single letter with surrounding whitespace", () => {
    assert.equal(hasSendableContent("  a \n"), true);
  });

  it("accepts emoji including multi-code-point sequences", () => {
    assert.equal(hasSendableContent("😀"), true);
    assert.equal(hasSendableContent("👨‍👩‍👧"), true);
    assert.equal(hasSendableContent("❤️"), true);
  });

  it("accepts non-Latin script", () => {
    assert.equal(hasSendableContent("你"), true);
  });
});
