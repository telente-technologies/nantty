export interface ListClipsQuery {
  readonly viewerId: string | undefined;
  readonly tab: "forYou" | "following";
  readonly cursor: string | undefined;
  readonly limit: number;
}
