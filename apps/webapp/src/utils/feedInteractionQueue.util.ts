export type FeedInteractionSurface = "feed" | "clips" | "profile" | "post_detail" | "explore" | "hashtag" | "search";
export type FeedInteractionKind = "view" | "dwell" | "watch" | "link_click" | "profile_click" | "follow";

export interface FeedInteractionTarget {
  readonly postId: string;
  readonly authorId: string;
}

export interface FeedInteraction {
  readonly postId: string;
  readonly kind: FeedInteractionKind;
  readonly surface: FeedInteractionSurface;
  readonly dwellMs?: number;
  readonly watchFraction?: number;
  readonly watchMs?: number;
  readonly loopCount?: number;
  readonly durationMs?: number;
  readonly position?: number;
}

export interface ClipWatchSummary {
  readonly watchMs: number;
  readonly durationMs: number;
  readonly watchFraction: number;
  readonly loopCount: number;
}

interface PendingFeedInteraction extends FeedInteraction {
  readonly accountId: string;
}

export type SendOutcome = "sent" | "rejected" | "retry";

export interface FeedInteractionQueueDeps {
  readonly send: (events: readonly FeedInteraction[], options: { readonly keepalive: boolean }) => Promise<SendOutcome>;
  readonly load: () => readonly unknown[];
  readonly save: (events: readonly unknown[]) => void;
  readonly isOnline: () => boolean;
  readonly schedule: (callback: () => void, delayMs: number) => () => void;
}

export const FEED_INTERACTIONS_BATCH_PATH = "/api/v1/feeds/interactions/batch";
export const MAXIMUM_INTERACTIONS_PER_BATCH = 50;
const MAXIMUM_PENDING_KEPT = 500;
const BATCH_FLUSH_DELAY_MS = 4_000;
const MAXIMUM_RETRY_DELAY_MS = 5 * 60_000;
const MAXIMUM_MILLISECONDS = 3_600_000;

const clampInteger = (value: number, maximum: number) => Math.min(maximum, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));

export function sanitizeFeedInteraction(interaction: FeedInteraction): FeedInteraction {
  const optional = (key: "dwellMs" | "watchMs" | "durationMs" | "loopCount" | "position", maximum: number) =>
    interaction[key] === undefined ? {} : { [key]: clampInteger(interaction[key]!, maximum) };
  return {
    postId: interaction.postId,
    kind: interaction.kind,
    surface: interaction.surface,
    ...optional("dwellMs", MAXIMUM_MILLISECONDS),
    ...optional("watchMs", MAXIMUM_MILLISECONDS),
    ...optional("durationMs", MAXIMUM_MILLISECONDS),
    ...optional("loopCount", 100),
    ...optional("position", 10_000),
    ...(interaction.watchFraction === undefined ? {} : { watchFraction: Math.min(1, Math.max(0, Number.isFinite(interaction.watchFraction) ? interaction.watchFraction : 0)) }),
  };
}

export function outcomeForStatus(status: number): SendOutcome {
  if (status >= 200 && status < 300) return "sent";
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return "rejected";
  return "retry";
}

export function retryDelayAfterFailures(failures: number): number {
  return Math.min(MAXIMUM_RETRY_DELAY_MS, BATCH_FLUSH_DELAY_MS * 2 ** Math.max(0, failures - 1));
}

const isPendingInteraction = (value: unknown): value is PendingFeedInteraction =>
  !!value && typeof value === "object" && typeof (value as PendingFeedInteraction).postId === "string" && typeof (value as PendingFeedInteraction).accountId === "string";

export function createFeedInteractionQueue(deps: FeedInteractionQueueDeps) {
  let viewerId: string | null = null;
  let pending: PendingFeedInteraction[] = deps.load().filter(isPendingInteraction).slice(-MAXIMUM_PENDING_KEPT);
  let cancelScheduled: (() => void) | null = null;
  let inFlight: Promise<void> | null = null;
  let failures = 0;
  const viewKeys = new Set<string>();

  const persist = () => deps.save(pending);

  const schedule = (delayMs: number) => {
    if (cancelScheduled) return;
    cancelScheduled = deps.schedule(() => {
      cancelScheduled = null;
      void flush(false);
    }, delayMs);
  };

  function flush(keepalive: boolean): Promise<void> {
    inFlight ??= sendPending(keepalive).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  async function sendPending(keepalive: boolean): Promise<void> {
    if (cancelScheduled) cancelScheduled();
    cancelScheduled = null;
    pending = viewerId ? pending.filter((event) => event.accountId === viewerId) : [];
    while (pending.length > 0 && deps.isOnline()) {
      const batch = pending.slice(0, MAXIMUM_INTERACTIONS_PER_BATCH);
      const outcome = await deps.send(batch.map(({ accountId: _owner, ...event }) => event), { keepalive });
      if (outcome === "retry") {
        failures += 1;
        schedule(retryDelayAfterFailures(failures));
        return;
      }
      failures = 0;
      pending = pending.slice(batch.length);
      persist();
    }
  }

  const isOwn = (target: FeedInteractionTarget) => target.authorId === viewerId;

  function enqueue(target: FeedInteractionTarget, interaction: FeedInteraction) {
    if (!viewerId || isOwn(target)) return;
    pending = [...pending, { ...sanitizeFeedInteraction(interaction), accountId: viewerId }].slice(-MAXIMUM_PENDING_KEPT);
    persist();
    if (pending.length >= MAXIMUM_INTERACTIONS_PER_BATCH) void flush(false);
    else schedule(failures > 0 ? retryDelayAfterFailures(failures) : BATCH_FLUSH_DELAY_MS);
  }

  return {
    setViewer(nextViewerId: string | null) {
      if (nextViewerId === viewerId) return;
      if (viewerId !== null && nextViewerId !== viewerId) {
        pending = [];
        viewKeys.clear();
        persist();
      }
      viewerId = nextViewerId;
      if (viewerId && pending.length > 0) schedule(BATCH_FLUSH_DELAY_MS);
    },
    recordViewOncePerSession(target: FeedInteractionTarget, surface: FeedInteractionSurface, position?: number): boolean {
      const key = `${surface}:${target.postId}`;
      if (!viewerId || isOwn(target) || viewKeys.has(key)) return false;
      viewKeys.add(key);
      enqueue(target, { postId: target.postId, kind: "view", surface, position });
      return true;
    },
    recordDwell(target: FeedInteractionTarget, surface: FeedInteractionSurface, dwellMs: number, position?: number) {
      if (dwellMs > 0) enqueue(target, { postId: target.postId, kind: "dwell", surface, dwellMs, position });
    },
    recordClipWatch(target: FeedInteractionTarget, surface: FeedInteractionSurface, watch: ClipWatchSummary) {
      if (watch.watchMs > 0) enqueue(target, { postId: target.postId, kind: "watch", surface, ...watch });
    },
    recordLinkClick: (target: FeedInteractionTarget, surface: FeedInteractionSurface) => enqueue(target, { postId: target.postId, kind: "link_click", surface }),
    recordProfileClick: (target: FeedInteractionTarget, surface: FeedInteractionSurface) => enqueue(target, { postId: target.postId, kind: "profile_click", surface }),
    recordFollow: (target: FeedInteractionTarget, surface: FeedInteractionSurface) => enqueue(target, { postId: target.postId, kind: "follow", surface }),
    flush: () => flush(false),
    flushBeforeUnload: () => flush(true),
    pendingCount: () => pending.length,
  };
}

export type FeedInteractionQueue = ReturnType<typeof createFeedInteractionQueue>;
