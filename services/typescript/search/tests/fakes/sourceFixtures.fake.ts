import type { BrandSource, CategorySource, PostSource, ProductSource, SoundSource, SourceHydrator, StoreSource, UserSource } from "../../src/interfaces/sourceHydrator.interface.js";

export const accountA = "11111111-1111-4111-8111-111111111111";
export const accountB = "22222222-2222-4222-8222-222222222222";
export const accountC = "33333333-3333-4333-8333-333333333333";

export const userSource = (overrides: Partial<UserSource> = {}): UserSource => ({ accountId: accountA, username: "ada_lovelace", displayName: "Ada Lovelace", bio: "maker of engines", avatarUrl: null, verified: false, verification: null, isCreator: false, isPrivate: false, status: "active", followerCount: 10, createdAt: "2026-01-01T00:00:00.000Z", ...overrides });
export const storeSource = (overrides: Partial<StoreSource> = {}): StoreSource => ({ storeId: "store_1", ownerAccountId: accountB, name: "Lagos Sneakers", handle: "lagossneakers", description: "Fresh kicks", logoUrl: null, rating: 4.5, ratingCount: 20, reviewCount: 12, verified: true, verification: null, active: true, countryCode: "NG", categoryNames: ["Shoes"], createdAt: "2026-01-02T00:00:00.000Z", ...overrides });
export const brandSource = (overrides: Partial<BrandSource> = {}): BrandSource => ({ brandId: "brand_1", ownerAccountId: null, name: "Adire House", handle: "adirehouse", description: "Indigo textiles", logoUrl: null, verified: false, verification: null, followerCount: 50, officialStoreId: null, active: true, createdAt: "2026-01-03T00:00:00.000Z", ...overrides });
export const productSource = (overrides: Partial<ProductSource> = {}): ProductSource => ({ productId: "prod_1", storeId: "store_1", ownerAccountId: accountB, name: "Red running sneakers", description: "Light and fast", brandName: "Nantty", categoryPath: ["Shoes", "Running"], tags: ["running"], priceAmountMinor: 2500000, currency: "NGN", imageUrl: null, stock: 5, status: "published", visibility: "public", storeActive: true, countryCode: "NG", purchaseCount: 3, createdAt: "2026-01-04T00:00:00.000Z", ...overrides });
export const postSource = (overrides: Partial<PostSource> = {}): PostSource => ({ postId: "post_1", authorId: accountA, kind: "post", caption: "New #sneakers drop in Lagos", hashtags: [], audience: "everyone", visibility: "public", thumbnailUrl: null, soundTitle: null, likeCount: 4, viewCount: 100, removed: false, createdAt: "2026-01-05T00:00:00.000Z", ...overrides });
export const categorySource = (overrides: Partial<CategorySource> = {}): CategorySource => ({ categoryId: "cat_1", name: "Sneakers", synonyms: ["trainers"], path: ["Shoes", "Sneakers"], active: true, createdAt: "2026-01-06T00:00:00.000Z", ...overrides });
export const soundSource = (overrides: Partial<SoundSource> = {}): SoundSource => ({ soundId: "sound_1", title: "Lagos Nights", artist: "DJ Nantty", coverUrl: null, useCount: 9, active: true, createdAt: "2026-01-07T00:00:00.000Z", ...overrides });

export class FakeSourceHydrator implements SourceHydrator {
  public users = new Map<string, UserSource>();
  public stores = new Map<string, StoreSource>();
  public brands = new Map<string, BrandSource>();
  public products = new Map<string, ProductSource>();
  public posts = new Map<string, PostSource>();
  public categories = new Map<string, CategorySource>();
  public sounds = new Map<string, SoundSource>();
  public failNext = false;

  private read<T>(map: Map<string, T>, id: string): Promise<T | null> {
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error("source unavailable"));
    }
    return Promise.resolve(map.get(id) ?? null);
  }

  public fetchUser(id: string) { return this.read(this.users, id); }
  public fetchStore(id: string) { return this.read(this.stores, id); }
  public fetchBrand(id: string) { return this.read(this.brands, id); }
  public fetchProduct(id: string) { return this.read(this.products, id); }
  public fetchPost(id: string) { return this.read(this.posts, id); }
  public fetchCategory(id: string) { return this.read(this.categories, id); }
  public fetchSound(id: string) { return this.read(this.sounds, id); }
}
