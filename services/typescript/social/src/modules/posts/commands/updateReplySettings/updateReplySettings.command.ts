export interface UpdateReplySettingsCommand {
  readonly actorId: string;
  readonly postId: string;
  readonly replyPolicy: "everyone" | "following" | "followers" | "mentioned" | "off";
}
