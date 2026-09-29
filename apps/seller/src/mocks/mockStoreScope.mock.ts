import { AsyncLocalStorage } from "node:async_hooks";

const mockStoreScopeStorage = new AsyncLocalStorage<{ readonly storeId: string | null }>();

export function runWithinMockStoreScope<Result>(storeId: string | null, callback: () => Result): Result {
  return mockStoreScopeStorage.run({ storeId }, callback);
}

export function readStoreIdOfCurrentMockScope(): string | null {
  return mockStoreScopeStorage.getStore()?.storeId ?? null;
}
