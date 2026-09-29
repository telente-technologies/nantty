import { CommandHandler } from "@zudojs/cqrs";

import { STORY_TTL_SECONDS } from "../../../../constants/security.constant.js";
import { unprocessable } from "../../../../errors/domain.error.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import type { PostDto } from "../../dtos/posts.dto.js";
import { PostCreatedEvent } from "../../events/postCreated.event.js";
import type { PostMedia } from "../../models/posts.model.js";
import type { PostsService } from "../../services/posts.service.js";
import type { CreatePostBody } from "../../validators/posts.validator.js";
import type { CreatePostCommand } from "./createPost.command.js";

function resolvePostMedia(input: CreatePostBody["media"]): PostMedia[] {
  return (input ?? []).map((item) => {
    const url = item.url ?? (item.mediaId === undefined ? undefined : `/api/v1/media/${item.mediaId}`);
    if (url === undefined) throw unprocessable("Each media item needs a url or a mediaId.");
    return { url, type: item.type };
  });
}

function assertMediaFitsPostKind(kind: CreatePostBody["kind"], media: readonly PostMedia[], text: string, isRepost: boolean): void {
  if (kind === "clip" && (media.length !== 1 || media[0]?.type !== "video")) throw unprocessable("A clip needs exactly one video.");
  if (kind === "story" && media.length === 0) throw unprocessable("A story needs an image or a video.");
  if (kind === "post" && media.length === 0 && text.trim() === "" && !isRepost) throw unprocessable("Write something or add media.");
}

export class CreatePostHandler extends CommandHandler<CreatePostCommand, PostDto> {
  public readonly commandType = "posts.createPost" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: CreatePostCommand): Promise<PostDto> {
    const { posts, storeAccess, clock, events } = this.postsService.dependencies;
    const authorId = command.principal.userId;
    const input = command.input;
    const media = resolvePostMedia(input.media);
    const text = input.text?.trim() ?? "";
    assertMediaFitsPostKind(input.kind, media, text, input.repostOfId !== undefined);
    if (input.storeId !== undefined) await storeAccess.assertStoreMember(authorId, input.storeId);
    await this.postsService.findPublishedProductsOrThrow(input.productIds ?? []);
    const original = input.repostOfId === undefined ? undefined : await this.postsService.findVisiblePostOrThrow(input.repostOfId, authorId);
    const now = clock.now();
    const post = await posts.create({
      authorId,
      storeId: input.storeId ?? null,
      kind: input.kind,
      text,
      media,
      topics: [...new Set(input.topics ?? [])],
      productIds: [...new Set(input.productIds ?? [])],
      repostOfId: original === undefined ? null : original.repostOfId ?? original.id,
      expiresAt: input.kind === "story" ? new Date(now.getTime() + STORY_TTL_SECONDS * 1000) : null,
      createdAt: now,
    });
    if (post.repostOfId !== null) await posts.changeCounter(post.repostOfId, "repostCount", 1);
    await publishEvent(events, PostCreatedEvent, { postId: post.id, authorId, kind: post.kind });
    const [dto] = await this.postsService.presenter.presentPosts([post], authorId, command.displayCurrency);
    return dto as PostDto;
  }
}
