import type { SourceHydrator } from "../../../interfaces/sourceHydrator.interface.js";
import type { SearchIndexStore } from "../../../interfaces/searchStore.interface.js";
import type { SearchKind } from "../../../types/searchDocument.type.js";
import { buildBrandDocument, buildProductDocument, buildStoreDocument, buildUserDocument } from "./entityDocumentBuilders.service.js";
import { buildCategoryDocument, buildPostDocument, buildSoundDocument } from "./contentDocumentBuilders.service.js";

export interface DocumentReindexer {
  reindexUser(accountId: string, version: number): Promise<void>;
  reindexStore(storeId: string, version: number): Promise<void>;
  reindexBrand(brandId: string, version: number): Promise<void>;
  reindexProduct(productId: string, version: number): Promise<void>;
  reindexPost(postId: string, version: number): Promise<void>;
  reindexCategory(categoryId: string, version: number): Promise<void>;
  reindexSound(soundId: string, version: number): Promise<void>;
  removePost(postId: string, version: number, kinds: readonly SearchKind[]): Promise<void>;
}

export function createDocumentReindexer(store: SearchIndexStore, hydrator: SourceHydrator): DocumentReindexer {
  const refreshTags = async (tags: readonly string[], version: number) => {
    for (const tag of new Set(tags)) await store.refreshHashtag(tag, version);
  };
  return {
    async reindexUser(accountId, version) {
      const source = await hydrator.fetchUser(accountId);
      if (source === null) {
        await store.patchAccountState(accountId, { status: "deleted" }, version);
        await store.tombstoneDocument("user", accountId, version);
        return;
      }
      await store.patchAccountState(accountId, { status: source.status, isPrivate: source.isPrivate }, version);
      await store.upsertDocument(buildUserDocument(source, version));
    },
    async reindexStore(storeId, version) {
      const source = await hydrator.fetchStore(storeId);
      if (source === null) await store.tombstoneDocument("store", storeId, version);
      else await store.upsertDocument(buildStoreDocument(source, version));
    },
    async reindexBrand(brandId, version) {
      const source = await hydrator.fetchBrand(brandId);
      if (source === null) await store.tombstoneDocument("brand", brandId, version);
      else await store.upsertDocument(buildBrandDocument(source, version));
    },
    async reindexProduct(productId, version) {
      const source = await hydrator.fetchProduct(productId);
      if (source === null) await store.tombstoneDocument("product", productId, version);
      else await store.upsertDocument(buildProductDocument(source, version));
    },
    async reindexPost(postId, version) {
      const source = await hydrator.fetchPost(postId);
      if (source === null) return void (await refreshTags([...(await store.tombstoneDocument("post", postId, version)), ...(await store.tombstoneDocument("clip", postId, version))], version));
      const document = buildPostDocument(source, version);
      if (document === null) return;
      const outcome = await store.upsertDocument(document);
      if (outcome.applied) await refreshTags([...outcome.previousTags, ...document.tags], version);
    },
    async reindexCategory(categoryId, version) {
      const source = await hydrator.fetchCategory(categoryId);
      if (source === null) await store.tombstoneDocument("category", categoryId, version);
      else await store.upsertDocument(buildCategoryDocument(source, version));
    },
    async reindexSound(soundId, version) {
      const source = await hydrator.fetchSound(soundId);
      if (source === null) await store.tombstoneDocument("sound", soundId, version);
      else await store.upsertDocument(buildSoundDocument(source, version));
    },
    async removePost(postId, version, kinds) {
      const tags: string[] = [];
      for (const kind of kinds) tags.push(...(await store.tombstoneDocument(kind, postId, version)));
      await refreshTags(tags, version);
    },
  };
}
