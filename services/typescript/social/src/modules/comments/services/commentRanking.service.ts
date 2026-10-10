export interface RankableRoot {
  readonly id: string;
  readonly authorId: string;
  readonly isPinned: boolean;
  readonly likeCount: number;
  readonly replyCount: number;
  readonly createdAt: Date;
}

export interface RankingSignals {
  readonly postAuthorId: string;
  readonly authorRepliedRootIds: ReadonlySet<string>;
  readonly now: Date;
}

export interface RankedPageCursor {
  readonly snapshotId: string;
  readonly offset: number;
  readonly tailAfterId: string | null;
  readonly hasTail: boolean;
}

const tierPinned = 3;
const tierAuthorComment = 2;
const tierAuthorJoined = 1;

export function authorTierOf(root: RankableRoot, signals: RankingSignals): number {
  if (root.isPinned) return tierPinned;
  if (root.authorId === signals.postAuthorId) return tierAuthorComment;
  return signals.authorRepliedRootIds.has(root.id) ? tierAuthorJoined : 0;
}

export function engagementScore(root: RankableRoot, now: Date): number {
  const ageHours = Math.max(0, (now.getTime() - root.createdAt.getTime()) / 3_600_000);
  return (root.likeCount + 2 * root.replyCount + 1) / Math.pow(ageHours + 2, 1.2);
}

export function rankConversationRoots<T extends RankableRoot>(roots: readonly T[], signals: RankingSignals): T[] {
  const keyed = roots.map((root) => ({ root, tier: authorTierOf(root, signals), score: engagementScore(root, signals.now) }));
  keyed.sort((left, right) => right.tier - left.tier || right.score - left.score || (left.root.id < right.root.id ? 1 : left.root.id > right.root.id ? -1 : 0));
  return keyed.map((entry) => entry.root);
}

export function encodeRankedCursor(cursor: RankedPageCursor): string {
  return Buffer.from(JSON.stringify({ s: cursor.snapshotId, o: cursor.offset, t: cursor.tailAfterId, m: cursor.hasTail ? 1 : 0 })).toString("base64url");
}

export function decodeRankedCursor(raw: string): RankedPageCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { s?: unknown; o?: unknown; t?: unknown; m?: unknown };
    if (typeof parsed.s !== "string" || !/^[0-9a-f-]{36}$/i.test(parsed.s)) return null;
    if (typeof parsed.o !== "number" || !Number.isInteger(parsed.o) || parsed.o < 0) return null;
    if (parsed.t !== null && (typeof parsed.t !== "string" || !/^[0-9a-f-]{36}$/i.test(parsed.t))) return null;
    return { snapshotId: parsed.s, offset: parsed.o, tailAfterId: parsed.t, hasTail: parsed.m === 1 };
  } catch {
    return null;
  }
}
