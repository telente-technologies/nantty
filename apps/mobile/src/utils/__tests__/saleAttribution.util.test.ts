import { isAffiliateLinkId, keepLiveSaleAttributions, readLiveSaleAttribution } from "../saleAttribution.util";

describe("sale attribution memory", () => {
  const now = 1_000_000;

  it("keeps the first creator touch per product until it expires, and the same creator refreshes it", () => {
    let byProduct = keepLiveSaleAttributions({}, "p1", { source: "post", id: "post_1" }, now + 10, now);
    byProduct = keepLiveSaleAttributions(byProduct, "p1", { source: "link", id: "link_1" }, now + 10, now);
    expect(readLiveSaleAttribution(byProduct, "p1", now)).toEqual({ source: "post", id: "post_1" });
    expect(readLiveSaleAttribution(keepLiveSaleAttributions(byProduct, "p1", { source: "post", id: "post_1" }, now + 50, now), "p1", now + 20)).toEqual({ source: "post", id: "post_1" });
    expect(readLiveSaleAttribution(keepLiveSaleAttributions(byProduct, "p1", { source: "link", id: "link_1" }, now + 50, now + 11), "p1", now + 20)).toEqual({ source: "link", id: "link_1" });
    expect(readLiveSaleAttribution(byProduct, "p2", now)).toBeNull();
    expect(readLiveSaleAttribution(byProduct, "p1", now + 11)).toBeNull();
  });

  it("drops unknown sources, expired entries and caps how many products it remembers", () => {
    expect(keepLiveSaleAttributions({}, "p1", { source: "banner" as never, id: "x" }, now + 10, now)).toEqual({});
    let byProduct = {};
    for (let index = 0; index < 60; index += 1) byProduct = keepLiveSaleAttributions(byProduct, `p${index}`, { source: "live", id: "l" }, now + 10, now);
    expect(Object.keys(byProduct)).toHaveLength(50);
    expect(readLiveSaleAttribution(byProduct, "p59", now)).toEqual({ source: "live", id: "l" });
  });

  it("only accepts affiliate link ids that look like ids", () => {
    expect(isAffiliateLinkId("0192a4f0-0000-7000-8000-000000000001")).toBe(true);
    expect(isAffiliateLinkId("../x")).toBe(false);
    expect(isAffiliateLinkId(undefined)).toBe(false);
  });
});
