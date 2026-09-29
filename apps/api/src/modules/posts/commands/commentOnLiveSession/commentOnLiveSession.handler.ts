import { CommandHandler } from "@zudojs/cqrs";

import type { LiveCommentDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { CommentOnLiveSessionCommand } from "./commentOnLiveSession.command.js";

export class CommentOnLiveSessionHandler extends CommandHandler<CommentOnLiveSessionCommand, LiveCommentDto> {
  public readonly commandType = "posts.commentOnLiveSession" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: CommentOnLiveSessionCommand): Promise<LiveCommentDto> {
    const { liveSessions, clock } = this.postsService.dependencies;
    const session = await this.postsService.findActiveLiveSessionOrThrow(command.sessionId, command.principal.userId);
    const comment = await liveSessions.createComment(session.id, command.principal.userId, command.text.trim(), clock.now());
    const [dto] = await this.postsService.presenter.presentLiveComments([comment]);
    return dto as LiveCommentDto;
  }
}
