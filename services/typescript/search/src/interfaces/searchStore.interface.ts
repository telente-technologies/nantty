import type { AccountState, ConsentType, SearchDocument, SearchKind } from "../types/searchDocument.type.js";
import type { RecentSearch, SearchHitPage, SearchRequest } from "../types/searchResult.type.js";

export interface UpsertOutcome {
  readonly applied: boolean;
  readonly previousTags: readonly string[];
}

export interface SearchIndexStore {
  upsertDocument(document: SearchDocument): Promise<UpsertOutcome>;
  tombstoneDocument(kind: SearchKind, entityId: string, version: number): Promise<readonly string[]>;
  refreshHashtag(tag: string, version: number): Promise<void>;
  patchAccountState(accountId: string, patch: Partial<AccountState>, version: number): Promise<void>;
  addBlock(blockerId: string, blockedId: string): Promise<void>;
  removeBlock(blockerId: string, blockedId: string): Promise<void>;
  addFollow(followerId: string, followeeId: string): Promise<void>;
  removeFollow(followerId: string, followeeId: string): Promise<void>;
  setConsent(accountId: string, consentType: ConsentType, granted: boolean): Promise<void>;
  hasConsent(accountId: string, consentType: ConsentType): Promise<boolean>;
  claimEvent(eventId: string): Promise<boolean>;
  releaseEvent(eventId: string): Promise<void>;
}

export interface SearchQueryStore {
  search(request: SearchRequest): Promise<SearchHitPage>;
}

export interface RecentSearchStore {
  record(accountId: string, normalized: string, display: string): Promise<void>;
  list(accountId: string, limit: number): Promise<readonly RecentSearch[]>;
  remove(accountId: string, id: string): Promise<void>;
  clear(accountId: string): Promise<void>;
}
