export interface ListMentionCandidatesQuery {
  readonly viewerId: string;
  readonly surface: "post" | "comment" | "group" | "direct";
  readonly term: string;
  readonly conversationId: string | undefined;
}
