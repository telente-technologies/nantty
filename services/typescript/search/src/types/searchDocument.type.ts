export type SearchKind = "user" | "store" | "brand" | "product" | "post" | "clip" | "category" | "hashtag" | "sound";
export type DocumentVisibility = "public" | "followers" | "hidden";

export interface SearchDocument {
  readonly kind: SearchKind;
  readonly entityId: string;
  readonly ownerAccountId: string | null;
  readonly title: string;
  readonly subtitle: string | null;
  readonly body: string;
  readonly tags: readonly string[];
  readonly summary: Readonly<Record<string, unknown>>;
  readonly visibility: DocumentVisibility;
  readonly available: boolean;
  readonly popularity: number;
  readonly region: string | null;
  readonly version: number;
  readonly createdAt: string;
}

export interface AccountState {
  readonly status: string;
  readonly isPrivate: boolean;
}

export type ConsentType = "analytics" | "personalization" | "advertising" | "marketing";
