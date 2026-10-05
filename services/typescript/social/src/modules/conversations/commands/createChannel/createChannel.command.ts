export interface CreateChannelCommand {
  readonly ownerId: string;
  readonly name: string;
  readonly description: string | undefined;
  readonly photoMediaId: string | undefined;
}
