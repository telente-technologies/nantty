import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { PostsService } from "../../services/posts.service.js";
import type { ReactToLiveSessionCommand } from "./reactToLiveSession.command.js";

export class ReactToLiveSessionHandler extends CommandHandler<ReactToLiveSessionCommand, { readonly emoji: string; readonly reactionCount: number }> {
  public readonly commandType = "posts.reactToLiveSession" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: ReactToLiveSessionCommand): Promise<{ readonly emoji: string; readonly reactionCount: number }> {
    const session = await this.postsService.findActiveLiveSessionOrThrow(command.sessionId, command.principal.userId);
    const updated = await this.postsService.dependencies.liveSessions.addReaction(session.id);
    if (updated === undefined) throw notFound("Live session");
    return { emoji: command.emoji, reactionCount: updated.reactionCount };
  }
}
