export interface SpamScoreProvider {
  scoreSenderBehaviour(accountId: string, metadata: { readonly recipientsInWindow: number; readonly accountAgeDays: number | null }): Promise<number | null>;
}
