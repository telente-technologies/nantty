import { describe, expect, it } from "vitest";

import { createSearchPlacesHandler } from "../../src/modules/places/queries/searchPlaces/searchPlaces.handler.js";
import { buildFreeTextPlace, createBundledPlacesProvider } from "../../src/modules/places/services/bundledPlaces.service.js";

const provider = createBundledPlacesProvider();
const searchPlaces = createSearchPlacesHandler(provider);

describe("bundled places provider", () => {
  it("finds cities across NG, GH, KE and ZA by prefix", async () => {
    expect((await provider.searchPlacesByName("lek", 10)).map((place) => place.name)).toContain("Lekki");
    expect((await provider.searchPlacesByName("kumasi", 10))[0]).toMatchObject({ name: "Kumasi", area: "Ashanti, Ghana" });
    expect((await provider.searchPlacesByName("nairobi", 10))[0]).toMatchObject({ name: "Nairobi", area: "Kenya" });
    expect((await provider.searchPlacesByName("cape", 10)).map((place) => place.name)).toEqual(expect.arrayContaining(["Cape Town", "Cape Coast"]));
  });

  it("ranks exact matches first and ignores case and accents", async () => {
    expect((await provider.searchPlacesByName("ÍBADAN", 5))[0]?.name).toBe("Ibadan");
  });

  it("returns stable ids and never coordinates", async () => {
    const [ikeja] = await provider.searchPlacesByName("ikeja", 1);
    expect(ikeja).toEqual({ placeId: "zm:ng:lagos:ikeja", name: "Ikeja", area: "Lagos, Nigeria" });
  });

  it("ignores one-letter searches", async () => {
    expect(await provider.searchPlacesByName("a", 10)).toEqual([]);
  });
});

describe("search places handler", () => {
  it("adds the typed text as a free-text place when it is not already listed", async () => {
    const { places } = await searchPlaces({ text: "  Mama Put   Yaba " });
    expect(places.at(-1)).toEqual({ placeId: "text:mama-put-yaba", name: "Mama Put Yaba", area: null });
  });

  it("does not duplicate an exact bundled match", async () => {
    const { places } = await searchPlaces({ text: "Accra" });
    expect(places.filter((place) => place.name === "Accra")).toHaveLength(1);
    expect(places.some((place) => place.placeId.startsWith("text:"))).toBe(false);
  });

  it("caps free text to the post location limits", () => {
    const place = buildFreeTextPlace("x".repeat(300));
    expect(place?.name.length).toBe(120);
    expect(buildFreeTextPlace("!!")).toBeNull();
  });
});
