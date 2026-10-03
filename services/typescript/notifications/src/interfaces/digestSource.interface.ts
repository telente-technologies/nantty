export type DigestKind = "weekly" | "followRequests" | "messageRequests";

export interface DigestEntry {
  readonly userId: string;
  readonly props: Readonly<Record<string, unknown>>;
}

export interface DigestSource {
  listPage(kind: DigestKind, cursor: string | null, limit: number): Promise<{ readonly data: readonly DigestEntry[]; readonly nextCursor: string | null }>;
}
