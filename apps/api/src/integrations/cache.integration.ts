import {
  createCacheService,
  createMemoryCacheAdapter,
  type CacheService,
} from "@zudojs/cache";

import type { Integration } from "./lifecycle.integration.js";

let service: CacheService | undefined;

export function cache(): CacheService {
  if (service === undefined) {
    throw new Error("The cache is not ready: start the runtime first.");
  }
  return service;
}

export const cacheIntegration: Integration = {
  name: "cache",

  async start({ config }) {
    service = createCacheService({
      adapter: createMemoryCacheAdapter({ maxEntries: config.cache.maxEntries }),
      config: { defaultTtl: config.cache.defaultTtlMs },
    });
  },

  async stop() {
    service = undefined;
  },

  async health() {
    return service !== undefined;
  },
};
