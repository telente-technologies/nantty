export interface StoreFollowState {
  readonly storeId: string;
  readonly isFollowing: boolean;
  readonly followers: number;
}

export function parseStoreFollowState(payload: unknown, expectedStoreId: string): StoreFollowState {
  const outer = asRecord(payload);
  const value = outer !== null && "data" in outer ? asRecord(outer.data) : outer;
  if (value === null || value.storeId !== expectedStoreId || typeof value.isFollowing !== "boolean") {
    throw new Error("Nantty returned an invalid store-follow state.");
  }
  const followers = value.followers;
  if (typeof followers !== "number" || !Number.isSafeInteger(followers) || followers < 0) {
    throw new Error("Nantty returned an invalid store-follow state.");
  }
  return { storeId: expectedStoreId, isFollowing: value.isFollowing, followers };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
