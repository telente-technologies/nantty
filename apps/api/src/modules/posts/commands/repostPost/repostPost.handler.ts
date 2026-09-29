import { CommandHandler } from "@zudojs/cqrs";

import { unprocessable } from "../../../../errors/domain.error.js";
import type { PostDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { RepostPostCommand } from "./repostPost.command.js";

export class RepostPostHandler extends CommandHandler<RepostPostCommand, PostDto> {
  public readonly commandType = "posts.repostPost" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: RepostPostCommand): Promise<PostDto> {
    const { posts, clock } = this.postsService.dependencies;
    const userId = command.principal.userId;
    const target = await this.postsService.findVisiblePostOrThrow(command.postId, userId);
    const original = target.repostOfId === null ? target : await this.postsService.findVisiblePostOrThrow(target.repostOfId, userId);
    if (original.kind === "story") throw unprocessable("Stories cannot be reposted.");
    await this.postsService.assertUsersAreNotBlocked(userId, original.authorId);
    const repost = await posts.create({
      authorId: userId,
      storeId: null,
      kind: "post",
      text: command.text.trim(),
      media: [],
      topics: original.topics,
      productIds: [],
      repostOfId: original.id,
      expiresAt: null,
      createdAt: clock.now(),
    });
    await posts.changeCounter(original.id, "repostCount", 1);
    await this.postsService.notifyUserUnlessSelf(userId, {
      userId: original.authorId,
      category: "social",
      title: "New repost",
      body: `${await this.postsService.findActorUsername(userId)} reposted your post.`,
      data: { type: "repost", postId: original.id, repostId: repost.id },
    });
    const [dto] = await this.postsService.presenter.presentPosts([repost], userId, command.displayCurrency);
    return dto as PostDto;
  }
}
