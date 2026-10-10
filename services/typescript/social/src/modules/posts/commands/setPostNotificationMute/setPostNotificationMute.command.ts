export interface SetPostNotificationMuteCommand {
  readonly actorId: string;
  readonly postId: string;
  readonly muted: boolean;
}

export interface PostNotificationMuteView {
  readonly postId: string;
  readonly muted: boolean;
}
