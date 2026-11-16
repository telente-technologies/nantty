export interface ReplyToStoryCommand {
  readonly viewerId: string;
  readonly storyId: string;
  readonly encryption: { readonly deviceId: string; readonly ciphertext: string; readonly protocol?: string | undefined };
  readonly idempotencyKey: string | undefined;
}
