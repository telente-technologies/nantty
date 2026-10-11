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

const isEngageablePostWithId = (postId: string): RecordMatcher => (record) =>
  record.id === postId && typeof record.liked === "boolean" && typeof record.likes === "number";

export function readCachedLikeState(queryClient: QueryClient, postId: string): { readonly liked: boolean; readonly likes: number } | undefined {
  for (const query of queryClient.getQueryCache().findAll()) {
    const found = findMatchingRecord(query.state.data, isEngageablePostWithId(postId), 0);
    if (found) return { liked: found.liked as boolean, likes: found.likes as number };
  }
  return undefined;
}

export function setLikedStateEverywhere(queryClient: QueryClient, postId: string, liked: boolean) {
  updateMatchingRecordsInEveryQuery(queryClient, isEngageablePostWithId(postId), (post) =>
    post.liked === liked ? post : { ...post, liked, likes: Math.max(0, (post.likes as number) + (liked ? 1 : -1)) },
  );
}

export function addRepostEverywhere(queryClient: QueryClient, postId: string) {
  updateMatchingRecordsInEveryQuery(queryClient, (record) => record.id === postId && typeof record.reposts === "number", (post) => ({ ...post, reposts: (post.reposts as number) + 1 }));
}

interface LikeSyncState {
  desired: boolean;
  confirmed: boolean;
  isSending: boolean;
}

const likeSyncByPostId = new Map<string, LikeSyncState>();

export interface LikeSender {
  readonly send: (postId: string, liked: boolean) => Promise<unknown>;
  readonly onFailed: (error: unknown) => void;
}

export function currentLikedState(queryClient: QueryClient, postId: string, fallback: boolean) {
  return likeSyncByPostId.get(postId)?.desired ?? readCachedLikeState(queryClient, postId)?.liked ?? fallback;
}

export async function setPostLiked(queryClient: QueryClient, postId: string, liked: boolean, fallbackLiked: boolean, sender: LikeSender): Promise<void> {
  const sync = likeSyncByPostId.get(postId) ?? { desired: liked, confirmed: currentLikedState(queryClient, postId, fallbackLiked), isSending: false };
  sync.desired = liked;
  likeSyncByPostId.set(postId, sync);
  setLikedStateEverywhere(queryClient, postId, liked);
  if (sync.isSending) return;
  sync.isSending = true;
  try {
    while (sync.desired !== sync.confirmed) {
      const target = sync.desired;
      try {
        await sender.send(postId, target);
        sync.confirmed = target;
      } catch (error) {
        sync.desired = sync.confirmed;
        setLikedStateEverywhere(queryClient, postId, sync.confirmed);
        sender.onFailed(error);
        return;
      }
    }
  } finally {
    sync.isSending = false;
    if (likeSyncByPostId.get(postId) === sync) likeSyncByPostId.delete(postId);
  }
}

export const resetPostLikeSyncForTests = () => likeSyncByPostId.clear();

export function setFollowingAuthorEverywhere(queryClient: QueryClient, authorId: string, isFollowingAuthor: boolean) {
  updateMatchingRecordsInEveryQuery(
    queryClient,
    (record) => typeof record.isFollowingAuthor === "boolean" && isRecord(record.author) && record.author.id === authorId,
    (post) => (post.isFollowingAuthor === isFollowingAuthor ? post : { ...post, isFollowingAuthor }),
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
