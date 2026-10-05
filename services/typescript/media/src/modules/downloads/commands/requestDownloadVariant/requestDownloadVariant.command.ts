export interface RequestDownloadVariantCommand {
  readonly mediaId: string;
  readonly requesterId: string;
  readonly watermarkHandle: string;
  readonly stripAudio: boolean;
}
