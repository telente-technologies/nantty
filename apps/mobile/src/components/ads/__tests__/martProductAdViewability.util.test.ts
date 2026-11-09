import { martProductAdVisibleFraction } from "../martProductAdViewability.util";

const viewport = { contentTop: 0, cardTop: 100, cardHeight: 200, scrollOffset: 0, viewportHeight: 600 };

describe("Mart product-ad viewability", () => {
  it("counts the whole card when it is within the viewport", () => {
    expect(martProductAdVisibleFraction(viewport)).toBe(1);
  });

  it("counts partial visibility at the viewport edges", () => {
    expect(martProductAdVisibleFraction({ ...viewport, cardTop: -100 })).toBe(0.5);
    expect(martProductAdVisibleFraction({ ...viewport, cardTop: 500 })).toBe(0.5);
  });

  it("returns zero for an offscreen, zero-height, or invalid card", () => {
    expect(martProductAdVisibleFraction({ ...viewport, cardTop: 700 })).toBe(0);
    expect(martProductAdVisibleFraction({ ...viewport, cardHeight: 0 })).toBe(0);
    expect(martProductAdVisibleFraction({ ...viewport, scrollOffset: Number.NaN })).toBe(0);
  });
});
