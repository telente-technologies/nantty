export interface ListSoundClipsQuery {
  readonly viewerId: string | undefined;
  readonly soundId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}
