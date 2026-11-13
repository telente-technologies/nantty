import type { Clip } from "@/types";
import type { ProductRecommendationSlot } from "@/utils/productsYouMightLikeLayout.util";

import { buildClipsPagerItems, clipForPagerAdImpression, clipOrdinalAtOrBeforePagerItem, clipsPagerItemIndexForClip } from "../clipsPagerItems.util";

const clips = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `clip-${index}`, products: [] }) as unknown as Clip);

describe("Clips product recommendation pages", () => {
  it("places the recommendation carousel after its organic clip boundary without replacing clip pages", () => {
    const sourceClips = clips(18);
    sourceClips[15] = { ...sourceClips[15]!, products: [{ id: "tagged-product" }] } as unknown as Clip;
    const items = buildClipsPagerItems(sourceClips, [{ kind: "productsYouMightLike", occurrence: 0, afterPostCount: 16 }]);

    expect(items).toHaveLength(19);
    expect(items[15]).toMatchObject({ kind: "clip", key: "clip-clip-15", clipIndex: 15 });
    expect(items[16]).toEqual({ kind: "productRecommendations", key: "product-recommendations-0", occurrence: 0, excludedProductIds: ["tagged-product"] });
    expect(items[17]).toMatchObject({ kind: "clip", key: "clip-clip-16", clipIndex: 16 });
    expect(clipsPagerItemIndexForClip(items, 16)).toBe(17);
    expect(clipOrdinalAtOrBeforePagerItem(items, 16)).toBe(15);
    expect(clipForPagerAdImpression(items[15]!)).toBe(items[15]!.kind === "clip" ? items[15]!.clip : null);
    expect(clipForPagerAdImpression(items[16]!)).toBeNull();
  });

  it("keeps the established first and repeat shelf boundaries in the Clips pager", () => {
    const sourceClips = clips(62);
    const slots: ProductRecommendationSlot[] = [
      { kind: "productsYouMightLike", occurrence: 0, afterPostCount: 16 },
      { kind: "productsYouMightLike", occurrence: 1, afterPostCount: 61 },
    ];
    const items = buildClipsPagerItems(sourceClips, slots);

    expect(items.filter((item) => item.kind === "productRecommendations").map((item) => item.key)).toEqual([
      "product-recommendations-0",
      "product-recommendations-1",
    ]);
    expect(items.filter((item) => item.kind === "productRecommendations").every((item) => item.excludedProductIds.length === 0)).toBe(true);
    expect(clipsPagerItemIndexForClip(items, 61)).toBe(63);
  });

  it("omits a recommendation page when every ranked product is already tagged on the preceding clip", () => {
    const sourceClips = clips(18);
    sourceClips[15] = { ...sourceClips[15]!, products: [{ id: "tagged-product" }] } as unknown as Clip;
    const items = buildClipsPagerItems(
      sourceClips,
      [{ kind: "productsYouMightLike", occurrence: 0, afterPostCount: 16 }],
      ["tagged-product"],
    );

    expect(items.some((item) => item.kind === "productRecommendations")).toBe(false);
    expect(items).toHaveLength(18);
  });
});
