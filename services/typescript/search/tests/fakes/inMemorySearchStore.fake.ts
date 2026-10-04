import type { RecentSearchStore, SearchIndexStore, SearchQueryStore, UpsertOutcome } from "../../src/interfaces/searchStore.interface.js";
import type { AccountState, ConsentType, SearchDocument } from "../../src/types/searchDocument.type.js";
import type { RecentSearch, SearchHit } from "../../src/types/searchResult.type.js";
import { buildNormalizedTitle } from "../../src/modules/indexing/services/normalizedTitle.service.js";
import { extractQueryTokens, stripLeadingMarkers } from "../../src/utils/queryNormalizer.util.js";

interface StoredDocument extends SearchDocument {
  readonly normalizedTitle: string;
  readonly tombstoned: boolean;
}

function editDistance(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index, ...new Array<number>(right.length).fill(0)]);
  for (let column = 0; column <= right.length; column += 1) (rows[0] as number[])[column] = column;
  for (let row = 1; row <= left.length; row += 1)
    for (let column = 1; column <= right.length; column += 1)
      (rows[row] as number[])[column] = Math.min((rows[row - 1] as number[])[column]! + 1, (rows[row] as number[])[column - 1]! + 1, (rows[row - 1] as number[])[column - 1]! + (left[row - 1] === right[column - 1] ? 0 : 1));
  return (rows[left.length] as number[])[right.length] ?? 0;
}

export class InMemorySearchStore implements SearchIndexStore, SearchQueryStore, RecentSearchStore {
  public readonly documents = new Map<string, StoredDocument>();
  public readonly accountStates = new Map<string, AccountState & { version: number }>();
  public readonly blocks = new Set<string>();
  public readonly follows = new Set<string>();
  public readonly consents = new Map<string, boolean>();
  public readonly processedEvents = new Set<string>();
  private readonly recents: (RecentSearch & { accountId: string; normalized: string })[] = [];

  public async upsertDocument(document: SearchDocument): Promise<UpsertOutcome> {
    const key = `${document.kind}:${document.entityId}`;
    const existing = this.documents.get(key);
    if (existing !== undefined && existing.version > document.version) return { applied: false, previousTags: existing.tags };
    this.documents.set(key, { ...document, normalizedTitle: buildNormalizedTitle(document), tombstoned: false });
    return { applied: true, previousTags: existing?.tags ?? [] };
  }

  public async tombstoneDocument(kind: SearchDocument["kind"], entityId: string, version: number): Promise<readonly string[]> {
    const key = `${kind}:${entityId}`;
    const existing = this.documents.get(key);
    if (existing === undefined || existing.version > version) return [];
    this.documents.set(key, { ...existing, available: false, visibility: "hidden", version, tombstoned: true });
    return existing.tags;
  }

  public async refreshHashtag(tag: string, version: number): Promise<void> {
    const total = [...this.documents.values()].filter((document) => (document.kind === "post" || document.kind === "clip") && document.available && document.restrictedForMinors !== true && document.visibility === "public" && document.tags.includes(tag) && this.isOpenAccount(document.ownerAccountId)).length;
    this.documents.set(`hashtag:${tag}`, { kind: "hashtag", entityId: tag, ownerAccountId: null, title: `#${tag}`, subtitle: null, body: "", tags: [], summary: { id: tag, tag, postCount: total }, visibility: "public", available: total > 0, popularity: total, region: null, version, createdAt: new Date(0).toISOString(), normalizedTitle: tag, tombstoned: false });
  }

  public async patchAccountState(accountId: string, patch: Partial<AccountState>, version: number): Promise<void> {
    const existing = this.accountStates.get(accountId) ?? { status: "active", isPrivate: false, version: 0 };
    if (existing.version > version) return;
    this.accountStates.set(accountId, { status: patch.status ?? existing.status, isPrivate: patch.isPrivate ?? existing.isPrivate, version });
  }

  public async addBlock(blockerId: string, blockedId: string): Promise<void> { this.blocks.add(`${blockerId}>${blockedId}`); }
  public async removeBlock(blockerId: string, blockedId: string): Promise<void> { this.blocks.delete(`${blockerId}>${blockedId}`); }
  public async addFollow(followerId: string, followeeId: string): Promise<void> { this.follows.add(`${followerId}>${followeeId}`); }
  public async removeFollow(followerId: string, followeeId: string): Promise<void> { this.follows.delete(`${followerId}>${followeeId}`); }
  public async setConsent(accountId: string, consentType: ConsentType, granted: boolean): Promise<void> { this.consents.set(`${accountId}:${consentType}`, granted); }
  public async hasConsent(accountId: string, consentType: ConsentType): Promise<boolean> { return this.consents.get(`${accountId}:${consentType}`) === true; }
  public async claimEvent(eventId: string): Promise<boolean> { return !this.processedEvents.has(eventId) && Boolean(this.processedEvents.add(eventId)); }
  public async releaseEvent(eventId: string): Promise<void> { this.processedEvents.delete(eventId); }

  private isOpenAccount(accountId: string | null): boolean {
    const state = accountId === null ? undefined : this.accountStates.get(accountId);
    return state === undefined || (state.status === "active" && !state.isPrivate);
  }

  private isVisible(document: StoredDocument, viewerId: string | undefined): boolean {
    const owner = document.ownerAccountId;
    const state = owner === null ? undefined : this.accountStates.get(owner);
    const follows = viewerId !== undefined && owner !== null && this.follows.has(`${viewerId}>${owner}`);
    if (!document.available || document.visibility === "hidden") return false;
    if (state !== undefined && state.status !== "active") return false;
    if (owner !== null && viewerId !== undefined && owner !== viewerId && (this.blocks.has(`${viewerId}>${owner}`) || this.blocks.has(`${owner}>${viewerId}`))) return false;
    if (["user", "post", "clip"].includes(document.kind) && owner !== null && owner !== viewerId && state?.isPrivate === true && !follows) return false;
    return document.visibility === "public" || owner === viewerId || (document.visibility === "followers" && follows);
  }

  private score(document: StoredDocument, needle: string, tokens: readonly string[]): number | null {
    const title = document.normalizedTitle;
    const text = `${title} ${document.subtitle ?? ""} ${document.body} ${document.tags.join(" ")}`.toLowerCase();
    const matchesText = tokens.every((token, index) => (index === tokens.length - 1 ? text.split(/\s+/).some((word) => word.startsWith(token)) : text.includes(token)));
    const fuzzy = title.split(/\s+/).some((word) => needle.length >= 4 && editDistance(word, needle) <= 2);
    if (!matchesText && !fuzzy) return null;
    return (title === needle ? 3 : 0) + (title.startsWith(needle) ? 1.5 : 0) + (matchesText ? 1 : 0.5) + Math.min(1, Math.log(1 + document.popularity) / 12) * 0.4;
  }

  public async search(request: Parameters<SearchQueryStore["search"]>[0]) {
    const needle = stripLeadingMarkers(request.normalizedQuery);
    const tokens = extractQueryTokens(request.normalizedQuery);
    if (tokens.length === 0) return { hits: [], hasMore: false };
    const scored = [...this.documents.values()]
      .filter((document) => request.kinds.includes(document.kind) && this.isVisible(document, request.viewerId) && (request.viewerIsAdult === true || document.restrictedForMinors !== true || document.ownerAccountId === request.viewerId) && (request.region === undefined || (document.shippingRegions ?? []).length === 0 || (document.shippingRegions ?? []).includes(request.region) || document.ownerAccountId === request.viewerId))
      .flatMap((document) => {
        const score = this.score(document, needle, tokens);
        return score === null ? [] : [{ document, score: Math.round(score * 1e6) / 1e6 }];
      })
      .sort((left, right) => right.score - left.score || `${left.document.kind}:${left.document.entityId}`.localeCompare(`${right.document.kind}:${right.document.entityId}`));
    const afterCursor = request.cursor === undefined ? scored : scored.filter(({ document, score }) => score < request.cursor!.score || (score === request.cursor!.score && `${document.kind}:${document.entityId}` > request.cursor!.key));
    const hits: SearchHit[] = afterCursor.slice(0, request.limit).map(({ document, score }) => ({ kind: document.kind, entityId: document.entityId, score, summary: document.summary, popularity: document.popularity, createdAt: document.createdAt, ownerAccountId: document.ownerAccountId }));
    return { hits, hasMore: afterCursor.length > request.limit };
  }

  public async record(accountId: string, normalized: string, display: string): Promise<void> {
    const index = this.recents.findIndex((entry) => entry.accountId === accountId && entry.normalized === normalized);
    if (index >= 0) this.recents.splice(index, 1);
    this.recents.unshift({ id: `00000000-0000-4000-8000-${String(this.recents.length + 1).padStart(12, "0")}`, accountId, normalized, query: display, searchedAt: new Date().toISOString() });
  }

  public async list(accountId: string, limit: number): Promise<readonly RecentSearch[]> {
    return this.recents.filter((entry) => entry.accountId === accountId).slice(0, limit).map(({ id, query, searchedAt }) => ({ id, query, searchedAt }));
  }

  public async remove(accountId: string, id: string): Promise<void> {
    const index = this.recents.findIndex((entry) => entry.accountId === accountId && entry.id === id);
    if (index >= 0) this.recents.splice(index, 1);
  }

  public async clear(accountId: string): Promise<void> {
    for (let index = this.recents.length - 1; index >= 0; index -= 1) if (this.recents[index]?.accountId === accountId) this.recents.splice(index, 1);
  }
}
