export interface ListMentionCandidatesQuery {
  readonly viewerId: string;
  readonly surface: "post" | "comment" | "group";
  readonly term: string;
  readonly conversationId: string | undefined;
}
