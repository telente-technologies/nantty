import type { HelpContentStore } from "../../interfaces/helpContentStore.interface.js";
import type { HelpCategoryRecord } from "../../types/helpContent.type.js";

export interface HelpContentModuleDependencies {
  readonly store: HelpContentStore;
}

export async function loadCategoryLookup(store: HelpContentStore): Promise<Map<string, HelpCategoryRecord>> {
  return new Map((await store.listCategories()).map((category) => [category.id, category]));
}
