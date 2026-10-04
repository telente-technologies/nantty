export type CopyrightAudioRemedyMode = "mute" | "restore";

export interface ApplyCopyrightAudioRemedyCommand {
  readonly claimId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly mode: CopyrightAudioRemedyMode;
  readonly occurredAt: Date;
}

export interface CopyrightAudioRemedyResult {
  readonly soundId: string | null;
  readonly postIds: readonly string[];
  readonly mediaIds: readonly string[];
}
