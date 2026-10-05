export interface ChatMediaDescriptor {
  readonly id: string;
  readonly ownerId: string;
  readonly purpose: string;
  readonly kind: string;
  readonly status: string;
  readonly sizeBytes: number;
  readonly durationSeconds?: number;
}

export interface ChatMediaAccess {
  describe(mediaId: string): Promise<ChatMediaDescriptor | undefined>;
  signForParticipant(mediaId: string, viewerId: string): Promise<string | null>;
}
