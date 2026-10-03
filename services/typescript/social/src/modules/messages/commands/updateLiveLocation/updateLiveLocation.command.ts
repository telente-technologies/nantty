export interface UpdateLiveLocationCommand {
  readonly viewerId: string;
  readonly messageId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly address: string | null | undefined;
}
