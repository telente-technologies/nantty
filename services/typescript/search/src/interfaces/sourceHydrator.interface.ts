export interface UserSource {
  readonly accountId: string;
  readonly username: string;
  readonly displayName: string;
  readonly bio: string;
  readonly avatarUrl: string | null;
  readonly verified: boolean;
  readonly verification: Readonly<Record<string, unknown>> | null;
  readonly isCreator: boolean;
  readonly isPrivate: boolean;
  readonly status: string;
  readonly followerCount: number;
  readonly createdAt: string;
}

export interface StoreSource {
  readonly storeId: string;
  readonly ownerAccountId: string;
  readonly name: string;
  readonly handle: string;
  readonly description: string;
  readonly logoUrl: string | null;
  readonly rating: number;
  readonly ratingCount: number;
  readonly reviewCount: number;
  readonly verified: boolean;
  readonly verification: Readonly<Record<string, unknown>> | null;
  readonly active: boolean;
  readonly countryCode: string | null;
  readonly categoryNames: readonly string[];
  readonly createdAt: string;
}

export interface BrandSource {
  readonly brandId: string;
  readonly ownerAccountId: string | null;
  readonly name: string;
  readonly handle: string;
  readonly description: string;
  readonly logoUrl: string | null;
  readonly verified: boolean;
  readonly verification: Readonly<Record<string, unknown>> | null;
  readonly followerCount: number;
  readonly officialStoreId: string | null;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface ProductSource {
  readonly productId: string;
  readonly storeId: string;
  readonly ownerAccountId: string;
  readonly name: string;
  readonly description: string;
  readonly brandName: string | null;
  readonly categoryPath: readonly string[];
  readonly tags: readonly string[];
  readonly priceAmountMinor: number;
  readonly currency: string;
  readonly imageUrl: string | null;
  readonly stock: number;
  readonly status: string;
  readonly visibility: string;
  readonly storeActive: boolean;
  readonly countryCode: string | null;
  readonly shippingRegions?: readonly string[];
  readonly purchaseCount: number;
  readonly createdAt: string;
}

export interface PostSource {
  readonly postId: string;
  readonly authorId: string;
  readonly kind: "post" | "clip" | "story";
  readonly caption: string;
  readonly hashtags: readonly string[];
  readonly audience: "everyone" | "followers";
  readonly visibility: "public" | "subscribers";
  readonly thumbnailUrl: string | null;
  readonly soundTitle: string | null;
  readonly likeCount: number;
  readonly viewCount: number;
  readonly removed: boolean;
  readonly sensitiveLabels?: readonly string[];
  readonly createdAt: string;
}

export interface CategorySource {
  readonly categoryId: string;
  readonly name: string;
  readonly synonyms: readonly string[];
  readonly path: readonly string[];
  readonly active: boolean;
  readonly createdAt: string;
}

export interface SoundSource {
  readonly soundId: string;
  readonly title: string;
  readonly artist: string | null;
  readonly coverUrl: string | null;
  readonly useCount: number;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface SourceHydrator {
  fetchUser(accountId: string): Promise<UserSource | null>;
  fetchStore(storeId: string): Promise<StoreSource | null>;
  fetchBrand(brandId: string): Promise<BrandSource | null>;
  fetchProduct(productId: string): Promise<ProductSource | null>;
  fetchPost(postId: string): Promise<PostSource | null>;
  fetchCategory(categoryId: string): Promise<CategorySource | null>;
  fetchSound(soundId: string): Promise<SoundSource | null>;
}
