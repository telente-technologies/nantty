import type { InternalSource } from "../configs/search.config.js";
import type { SourceHydrator } from "../interfaces/sourceHydrator.interface.js";

export interface HydratorSources {
  readonly identity: InternalSource | undefined;
  readonly commerce: InternalSource | undefined;
  readonly social: InternalSource | undefined;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

type SourceName = "identity" | "commerce" | "social";

export function createHttpSourceHydrator(sources: HydratorSources): SourceHydrator {
  const send = sources.fetchImplementation ?? fetch;
  const fetchSource = async <T>(source: SourceName, collection: string, id: string): Promise<T | null> => {
    const target = sources[source];
    if (target === undefined) throw new Error(`${source} internal source is not configured`);
    const url = new URL(`/api/v1/internal/search-sources/${collection}/${encodeURIComponent(id)}`, target.baseUrl);
    const response = await send(url, { headers: { "x-internal-token": target.internalToken }, signal: AbortSignal.timeout(sources.timeoutMs ?? 3000) });
    if (response.status === 404 || response.status === 410) return null;
    if (!response.ok) throw new Error(`${source} ${collection}/${id} responded ${response.status}`);
    return (await response.json()) as T;
  };
  return {
    fetchUser: (id) => fetchSource("identity", "users", id),
    fetchStore: (id) => fetchSource("commerce", "stores", id),
    fetchBrand: (id) => fetchSource("commerce", "brands", id),
    fetchProduct: (id) => fetchSource("commerce", "products", id),
    fetchCategory: (id) => fetchSource("commerce", "categories", id),
    fetchPost: (id) => fetchSource("social", "posts", id),
    fetchSound: (id) => fetchSource("social", "sounds", id),
  };
}
