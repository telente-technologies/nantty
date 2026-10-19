import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dragOffsetWithEdgeResistance, isHorizontalSectionSwipe, resolveSectionIndexAfterRelease, sectionIndexOf } from "./homeSectionSwipe.util";

const pageWidth = 400;

describe("home Feed/Mart swipe", () => {
  it("only claims clearly horizontal drags so vertical scrolling keeps working", () => {
    assert.equal(isHorizontalSectionSwipe(30, 4), true);
    assert.equal(isHorizontalSectionSwipe(10, 0), false);
    assert.equal(isHorizontalSectionSwipe(30, 25), false);
  });

  it("follows the finger and resists past the edges", () => {
    assert.equal(dragOffsetWithEdgeResistance(0, -150, pageWidth), -150);
    assert.ok(Math.abs(dragOffsetWithEdgeResistance(0, 100, pageWidth) - 30) < 1e-9);
    assert.ok(Math.abs(dragOffsetWithEdgeResistance(1, -100, pageWidth) + 430) < 1e-9);
  });

  it("springs back before 35% without a flick, commits past it or on a flick", () => {
    assert.equal(resolveSectionIndexAfterRelease(0, -100, -0.1, pageWidth), 0);
    assert.equal(resolveSectionIndexAfterRelease(0, -150, 0, pageWidth), 1);
    assert.equal(resolveSectionIndexAfterRelease(0, -40, -0.8, pageWidth), 1);
    assert.equal(resolveSectionIndexAfterRelease(1, 40, 0.8, pageWidth), 0);
    assert.equal(resolveSectionIndexAfterRelease(0, -100, 0.8, pageWidth), 0);
  });

  it("never moves past the first or last section", () => {
    assert.equal(resolveSectionIndexAfterRelease(0, 300, 1.5, pageWidth), 0);
    assert.equal(resolveSectionIndexAfterRelease(1, -300, -1.5, pageWidth), 1);
    assert.equal(sectionIndexOf("mart"), 1);
  });
});
