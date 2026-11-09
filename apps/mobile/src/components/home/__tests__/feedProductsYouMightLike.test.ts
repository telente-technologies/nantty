import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock";
import { planProductsYouMightLikeSlots, shouldFetchProductsYouMightLike } from "@/utils/productsYouMightLikeLayout.util";

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

const organicPosts = (count: number) => Array.from({ length: count }, () => ({ sponsored: null as null | { id: string } }));

describe("Products you might like feed placement", () => {
  it("starts after 16 organic posts and repeats about every 45 organic posts", () => {
    expect(planProductsYouMightLikeSlots(organicPosts(15), [], true, true)).toEqual([]);
    expect(planProductsYouMightLikeSlots(organicPosts(16), [], true, true)).toEqual([
      { kind: "productsYouMightLike", occurrence: 0, afterPostCount: 16 },
    ]);
    expect(planProductsYouMightLikeSlots(organicPosts(61), [], true, true)).toEqual([
      { kind: "productsYouMightLike", occurrence: 0, afterPostCount: 16 },
      { kind: "productsYouMightLike", occurrence: 1, afterPostCount: 61 },
    ]);
  });

  it("counts only organic posts and respects the shared module gap", () => {
    const posts = organicPosts(20);
    posts.splice(4, 0, { sponsored: { id: "ad-1" } }, { sponsored: { id: "ad-2" } });
    const slots = planProductsYouMightLikeSlots(posts, [{ afterPostCount: 18 }], true, true);

    expect(slots).toEqual([{ kind: "productsYouMightLike", occurrence: 0, afterPostCount: 19 }]);
  });

  it("omits unavailable recommendations and every Following-feed placement", () => {
    const posts = organicPosts(70);
    expect(planProductsYouMightLikeSlots(posts, [], false, true)).toEqual([]);
    expect(planProductsYouMightLikeSlots(posts, [], true, false)).toEqual([]);
  });

  it("does not fetch until the For You organic-post threshold is met", () => {
    expect(shouldFetchProductsYouMightLike(15, true)).toBe(false);
    expect(shouldFetchProductsYouMightLike(16, true)).toBe(true);
    expect(shouldFetchProductsYouMightLike(80, false)).toBe(false);
  });

});
