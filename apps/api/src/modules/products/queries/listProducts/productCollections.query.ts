import type { Page, PageRequest } from "../../../../types/pagination.type.js";
import { paginateSortedItems } from "../../../../utils/pagination.util.js";
import { calculateDiscountFraction, type ProductRecord } from "../../models/products.model.js";
import type { ProductsDependencies } from "../../services/products.service.js";

export type ProductCollection = "sales_of_the_day" | "featured_brands" | "new_arrivals";

const COLLECTION_CANDIDATE_LIMIT = 500;
const FEATURED_STORE_LIMIT = 20;
const PRODUCTS_PER_FEATURED_STORE = 25;

export async function listProductCollectionPage(
  dependencies: ProductsDependencies,
  collection: ProductCollection,
  hiddenStoreIds: readonly string[],
  page: PageRequest,
): Promise<Page<ProductRecord>> {
  const { products, stores } = dependencies;
  if (collection === "new_arrivals") return products.listPublished({ sort: "newest", excludedStoreIds: hiddenStoreIds }, page);
  if (collection === "sales_of_the_day") {
    const discounted = (await products.listDiscountedPublished(hiddenStoreIds, COLLECTION_CANDIDATE_LIMIT))
      .map((product) => ({ product, discount: calculateDiscountFraction(product) }))
      .filter((entry) => entry.discount > 0)
      .sort((left, right) => right.discount - left.discount || right.product.id.localeCompare(left.product.id))
      .map((entry) => entry.product);
    return paginateSortedItems(discounted, page);
  }
  const hidden = new Set(hiddenStoreIds);
  const featuredStores = (await stores.list({ featured: true }, { limit: FEATURED_STORE_LIMIT })).data.filter((store) => !hidden.has(store.id));
  const perStore = await Promise.all(
    featuredStores.map((store) => products.listPublished({ sort: "popular", storeId: store.id, excludedStoreIds: hiddenStoreIds }, { limit: PRODUCTS_PER_FEATURED_STORE })),
  );
  const merged = perStore.flatMap((storePage) => storePage.data).sort((left, right) => right.salesCount - left.salesCount || right.id.localeCompare(left.id));
  return paginateSortedItems(merged, page);
}
