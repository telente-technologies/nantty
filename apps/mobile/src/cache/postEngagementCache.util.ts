import type { QueryClient } from "@tanstack/react-query";

type CachedRecord = Record<string, unknown>;
type RecordMatcher = (record: CachedRecord) => boolean;

const MAXIMUM_WALK_DEPTH = 8;

const isRecord = (value: unknown): value is CachedRecord => typeof value === "object" && value !== null;

function mapMatchingRecords(value: unknown, isMatch: RecordMatcher, change: (record: CachedRecord) => CachedRecord, depth: number): unknown {
  if (!isRecord(value) || depth > MAXIMUM_WALK_DEPTH) return value;
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const mapped = mapMatchingRecords(item, isMatch, change, depth + 1);
      if (mapped !== item) changed = true;
      return mapped;
    });
    return changed ? next : value;
  }
  let next: CachedRecord | null = isMatch(value) ? change(value) : null;
  const source = next ?? value;
  for (const key of Object.keys(source)) {
    const mapped = mapMatchingRecords(source[key], isMatch, change, depth + 1);
    if (mapped === source[key]) continue;
    next = next ?? { ...value };
    next[key] = mapped;
  }
  return next ?? value;
}

function findMatchingRecord(value: unknown, isMatch: RecordMatcher, depth: number): CachedRecord | undefined {
  if (!isRecord(value) || depth > MAXIMUM_WALK_DEPTH) return undefined;
  if (!Array.isArray(value) && isMatch(value)) return value;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const found = findMatchingRecord(child, isMatch, depth + 1);
    if (found) return found;
  }
  return undefined;
}

export function updateMatchingRecordsInEveryQuery(queryClient: QueryClient, isMatch: RecordMatcher, change: (record: CachedRecord) => CachedRecord) {
  for (const query of queryClient.getQueryCache().findAll()) {
    const data = query.state.data;
    if (data === undefined) continue;
    const next = mapMatchingRecords(data, isMatch, change, 0);
    if (next !== data) queryClient.setQueryData(query.queryKey, next);
  }
}

export function findRecordInAnyQuery(queryClient: QueryClient, isMatch: RecordMatcher): CachedRecord | undefined {
  for (const query of queryClient.getQueryCache().findAll()) {
    const found = findMatchingRecord(query.state.data, isMatch, 0);
    if (found) return found;
  }
  return undefined;
}

export const isEngageablePostWithId = (postId: string): RecordMatcher => (record) =>
  record.id === postId && typeof record.liked === "boolean" && typeof record.likes === "number";

export const isPostByAuthorWithId = (authorId: string): RecordMatcher => (record) =>
  typeof record.isFollowingAuthor === "boolean" && isRecord(record.author) && record.author.id === authorId;

export const isPostWithRepostCount = (postId: string): RecordMatcher => (record) => record.id === postId && typeof record.reposts === "number";

export function setLikedStateEverywhere(queryClient: QueryClient, postId: string, liked: boolean) {
  updateMatchingRecordsInEveryQuery(queryClient, isEngageablePostWithId(postId), (post) =>
    post.liked === liked ? post : { ...post, liked, likes: Math.max(0, (post.likes as number) + (liked ? 1 : -1)) },
  );
}

export function readCachedLikedState(queryClient: QueryClient, postId: string): boolean | undefined {
  const cached = findRecordInAnyQuery(queryClient, isEngageablePostWithId(postId));
  return cached ? (cached.liked as boolean) : undefined;
}

export function setFollowingAuthorEverywhere(queryClient: QueryClient, authorId: string, isFollowingAuthor: boolean) {
  updateMatchingRecordsInEveryQuery(queryClient, isPostByAuthorWithId(authorId), (post) =>
    post.isFollowingAuthor === isFollowingAuthor ? post : { ...post, isFollowingAuthor },
  );
}

const isRemovedPost = (postId: string) => (value: unknown) => isRecord(value) && !Array.isArray(value) && value.id === postId;

function withoutPost(value: unknown, postId: string, depth: number): unknown {
  if (!isRecord(value) || depth > MAXIMUM_WALK_DEPTH) return value;
  if (Array.isArray(value)) {
    let changed = false;
    const next: unknown[] = [];
    for (const item of value) {
      if (isRemovedPost(postId)(item)) {
        changed = true;
        continue;
      }
      const mapped = withoutPost(item, postId, depth + 1);
      if (mapped !== item) changed = true;
      next.push(mapped);
    }
    return changed ? next : value;
  }
  let next: CachedRecord | null = null;
  if (isRecord(value.resharedFrom) && value.resharedFrom.id === postId) next = { ...value, resharedFrom: null, resharedFromUnavailable: true };
  const source = next ?? value;
  for (const key of Object.keys(source)) {
    if (key === "resharedFrom") continue;
    const mapped = withoutPost(source[key], postId, depth + 1);
    if (mapped === source[key]) continue;
    next = next ?? { ...value };
    next[key] = mapped;
  }
  return next ?? value;
}

export type CacheSnapshot = readonly (readonly [readonly unknown[], unknown])[];

export function removePostEverywhere(queryClient: QueryClient, postId: string): CacheSnapshot {
  const snapshot: [readonly unknown[], unknown][] = [];
  for (const query of queryClient.getQueryCache().findAll()) {
    const data = query.state.data;
    if (data === undefined) continue;
    if (isRemovedPost(postId)(data)) {
      snapshot.push([query.queryKey, data]);
      queryClient.removeQueries({ queryKey: query.queryKey, exact: true });
      continue;
    }
    const next = withoutPost(data, postId, 0);
    if (next === data) continue;
    snapshot.push([query.queryKey, data]);
    queryClient.setQueryData(query.queryKey, next);
  }
  return snapshot;
}

export function restoreCacheSnapshot(queryClient: QueryClient, snapshot: CacheSnapshot) {
  for (const [queryKey, data] of snapshot) queryClient.setQueryData(queryKey, data);
}
