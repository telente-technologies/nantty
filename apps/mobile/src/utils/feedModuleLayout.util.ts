import { feedModuleCadence, feedModulePriority, minimumPostsBetweenFeedModules, type FeedModuleCadence, type FeedModuleKind } from "@/constants/feedModules.constant";

export interface FeedModuleSlot {
  readonly kind: FeedModuleKind;
  readonly occurrence: number;
  readonly afterPostCount: number;
}

export interface FeedModulePlanInput {
  readonly postCount: number;
  readonly isModuleEnabled: (kind: FeedModuleKind) => boolean;
  readonly isOccurrenceAvailable?: (kind: FeedModuleKind, occurrence: number) => boolean;
  readonly cadence?: Readonly<Record<FeedModuleKind, FeedModuleCadence>>;
  readonly minimumPostsBetweenModules?: number;
}

interface DesiredSlot {
  readonly kind: FeedModuleKind;
  readonly desiredAfterPostCount: number;
}

function listDesiredSlots(kind: FeedModuleKind, cadence: FeedModuleCadence, postCount: number): DesiredSlot[] {
  const slots: DesiredSlot[] = [];
  for (let position = cadence.firstAfterPosts; position < postCount; position += cadence.repeatEveryPosts ?? Number.POSITIVE_INFINITY) {
    slots.push({ kind, desiredAfterPostCount: position });
    if (cadence.repeatEveryPosts === null || cadence.repeatEveryPosts <= 0) break;
  }
  return slots;
}

export function planFeedModuleSlots(input: FeedModulePlanInput): FeedModuleSlot[] {
  const cadence = input.cadence ?? feedModuleCadence;
  const minimumGap = Math.max(1, input.minimumPostsBetweenModules ?? minimumPostsBetweenFeedModules);
  const desired = feedModulePriority
    .filter((kind) => input.isModuleEnabled(kind))
    .flatMap((kind) => listDesiredSlots(kind, cadence[kind], input.postCount))
    .sort((left, right) => left.desiredAfterPostCount - right.desiredAfterPostCount || feedModulePriority.indexOf(left.kind) - feedModulePriority.indexOf(right.kind));
  const placedCountByKind = new Map<FeedModuleKind, number>();
  const slots: FeedModuleSlot[] = [];
  let lastPlacedAfter = Number.NEGATIVE_INFINITY;
  for (const candidate of desired) {
    const occurrence = placedCountByKind.get(candidate.kind) ?? 0;
    const afterPostCount = Math.max(candidate.desiredAfterPostCount, lastPlacedAfter + minimumGap);
    if (afterPostCount >= input.postCount) continue;
    if (input.isOccurrenceAvailable && !input.isOccurrenceAvailable(candidate.kind, occurrence)) continue;
    slots.push({ kind: candidate.kind, occurrence, afterPostCount });
    placedCountByKind.set(candidate.kind, occurrence + 1);
    lastPlacedAfter = afterPostCount;
  }
  return slots;
}

export type FeedRowWithModules<Post> =
  | { readonly type: "post"; readonly post: Post; readonly postIndex: number }
  | { readonly type: "module"; readonly slot: FeedModuleSlot };

export function interleaveFeedModules<Post>(posts: readonly Post[], slots: readonly FeedModuleSlot[]): FeedRowWithModules<Post>[] {
  const rows: FeedRowWithModules<Post>[] = [];
  let nextSlotIndex = 0;
  posts.forEach((post, postIndex) => {
    while (nextSlotIndex < slots.length && slots[nextSlotIndex]!.afterPostCount === postIndex) rows.push({ type: "module", slot: slots[nextSlotIndex++]! });
    rows.push({ type: "post", post, postIndex });
  });
  while (nextSlotIndex < slots.length && slots[nextSlotIndex]!.afterPostCount === posts.length) rows.push({ type: "module", slot: slots[nextSlotIndex++]! });
  return rows;
}

export const feedModuleRowKey = (slot: FeedModuleSlot) => `${slot.kind}-${slot.occurrence}`;

export function takeChunkForOccurrence<Item>(items: readonly Item[], occurrence: number, chunkSize: number): Item[] {
  return items.slice(occurrence * chunkSize, (occurrence + 1) * chunkSize);
}
