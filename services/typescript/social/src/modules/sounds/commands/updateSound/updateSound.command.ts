export interface UpdateSoundCommand {
  readonly viewerId: string;
  readonly soundId: string;
  readonly title: string | undefined;
  readonly allowReuse: boolean | undefined;
}
