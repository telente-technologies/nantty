import { CommandHandler } from "@zudojs/cqrs";

import type { PostsService } from "../../services/posts.service.js";
import type { ShareLiveSessionCommand } from "./shareLiveSession.command.js";

export class ShareLiveSessionHandler extends CommandHandler<ShareLiveSessionCommand, { readonly sharedWith: number }> {
  public readonly commandType = "posts.shareLiveSession" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: ShareLiveSessionCommand): Promise<{ readonly sharedWith: number }> {
    const { socialGraph } = this.postsService.dependencies;
    const senderId = command.principal.userId;
    const session = await this.postsService.findActiveLiveSessionOrThrow(command.sessionId, senderId);
    const actor = await this.postsService.findActorUsername(senderId);
    let sharedWith = 0;
    for (const recipientId of new Set(command.recipientIds)) {
      if (recipientId === senderId || (await socialGraph.isBlockedEitherWay(senderId, recipientId))) continue;
      await this.postsService.notifyUserUnlessSelf(senderId, {
        userId: recipientId,
        category: "live",
        title: "Live now",
        body: `${actor} shared a live session with you: ${session.title}`,
        data: { type: "live", liveSessionId: session.id },
      });
      sharedWith += 1;
    }
    return { sharedWith };
  }
}
