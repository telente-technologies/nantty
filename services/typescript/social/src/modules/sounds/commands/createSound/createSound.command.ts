export interface CreateSoundCommand {
  readonly ownerId: string;
  readonly title: string;
  readonly audioUrl: string | undefined;
  readonly coverUrl: string | undefined;
  readonly sourceClipId: string | undefined;
  readonly allowReuse: boolean;
}
