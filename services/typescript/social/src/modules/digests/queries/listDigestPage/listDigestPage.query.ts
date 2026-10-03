export type DigestKind = "weekly" | "followRequests" | "messageRequests";

export interface ListDigestPageQuery {
  readonly kind: DigestKind;
  readonly cursor: string | undefined;
  readonly limit: number;
  readonly since: Date;
}
