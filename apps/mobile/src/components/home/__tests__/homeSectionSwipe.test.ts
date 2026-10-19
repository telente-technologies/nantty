import { dragOffsetWithEdgeResistance, isHorizontalSectionSwipe, resolveSectionIndexAfterRelease, sectionIndexOf } from "../homeSectionSwipe.util";

const pageWidth = 400;

describe("home Feed/Mart swipe", () => {
  it("only claims clearly horizontal drags so vertical feed scrolling keeps working", () => {
    expect(isHorizontalSectionSwipe(30, 4)).toBe(true);
    expect(isHorizontalSectionSwipe(-30, 4)).toBe(true);
    expect(isHorizontalSectionSwipe(10, 0)).toBe(false);
    expect(isHorizontalSectionSwipe(30, 25)).toBe(false);
  });

  it("follows the finger between pages", () => {
    expect(dragOffsetWithEdgeResistance(0, -150, pageWidth)).toBe(-150);
    expect(dragOffsetWithEdgeResistance(1, 120, pageWidth)).toBe(-280);
  });

  it("resists dragging past the first and last page", () => {
    expect(dragOffsetWithEdgeResistance(0, 100, pageWidth)).toBeCloseTo(30);
    expect(dragOffsetWithEdgeResistance(1, -100, pageWidth)).toBeCloseTo(-430);
  });

  it("springs back when released before halfway without a flick", () => {
    expect(resolveSectionIndexAfterRelease(0, -100, -0.1, pageWidth)).toBe(0);
    expect(resolveSectionIndexAfterRelease(1, 100, 0.1, pageWidth)).toBe(1);
  });

  it("commits after dragging past 35% of the page", () => {
    expect(resolveSectionIndexAfterRelease(0, -150, 0, pageWidth)).toBe(1);
    expect(resolveSectionIndexAfterRelease(1, 150, 0, pageWidth)).toBe(0);
  });

  it("commits on a quick flick even over a short distance", () => {
    expect(resolveSectionIndexAfterRelease(0, -40, -0.8, pageWidth)).toBe(1);
    expect(resolveSectionIndexAfterRelease(1, 40, 0.8, pageWidth)).toBe(0);
  });

  it("ignores a flick that reverses direction at release", () => {
    expect(resolveSectionIndexAfterRelease(0, -100, 0.8, pageWidth)).toBe(0);
  });

  it("never moves past the first or last section", () => {
    expect(resolveSectionIndexAfterRelease(0, 300, 1.5, pageWidth)).toBe(0);
    expect(resolveSectionIndexAfterRelease(1, -300, -1.5, pageWidth)).toBe(1);
  });

  it("maps sections to pages", () => {
    expect(sectionIndexOf("feed")).toBe(0);
    expect(sectionIndexOf("mart")).toBe(1);
  });
});
