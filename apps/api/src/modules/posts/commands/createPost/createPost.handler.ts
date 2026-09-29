import { CommandHandler } from "@zudojs/cqrs";

import { STORY_TTL_SECONDS } from "../../../../constants/security.constant.js";
import { invalidState, notFound, unprocessable } from "../../../../errors/domain.error.js";
import type { MediaLibrary, MediaLibraryItem } from "../../../../interfaces/mediaLibrary.interface.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import type { PostDto } from "../../dtos/posts.dto.js";
import { PostCreatedEvent } from "../../events/postCreated.event.js";
import type { PostMedia } from "../../models/posts.model.js";
import type { PostsService } from "../../services/posts.service.js";
import type { CreatePostBody } from "../../validators/posts.validator.js";
import type { CreatePostCommand } from "./createPost.command.js";

const MAX_POST_MEDIA = 10;

function convertLibraryItemToPostMedia(item: MediaLibraryItem): PostMedia {
  if (item.type !== "image" && item.type !== "video") throw unprocessable("Only images and videos can be attached to posts.");
  if (item.url === null) throw unprocessable("This media cannot be attached to a post.");
  return {
    type: item.type,
    url: item.url,
    mediaId: item.id,
    ...(item.posterUrl === null ? {} : { posterUrl: item.posterUrl }),
    ...(item.width === null ? {} : { width: item.width }),
    ...(item.height === null ? {} : { height: item.height }),
    ...(item.blurhash === null ? {} : { blurhash: item.blurhash }),
  };
}

async function resolveUploadedMedia(mediaLibrary: MediaLibrary, authorId: string, mediaIds: readonly string[]): Promise<Map<string, PostMedia>> {
  const uniqueIds = [...new Set(mediaIds)];
  if (uniqueIds.length === 0) return new Map();
  const items = new Map((await mediaLibrary.findMediaByIds(uniqueIds)).map((item) => [item.id, item]));
  const resolved = new Map<string, PostMedia>();
  for (const mediaId of uniqueIds) {
    const item = items.get(mediaId);
    if (item === undefined || item.ownerId !== authorId) throw notFound("Media");
    if (item.status === "processing") throw invalidState("Media is still processing");
    if (item.status === "failed") throw unprocessable("Media processing failed; upload the file again.");
    resolved.set(mediaId, convertLibraryItemToPostMedia(item));
  }
  return resolved;
}

async function resolvePostMedia(mediaLibrary: MediaLibrary, authorId: string, input: CreatePostBody): Promise<PostMedia[]> {
  const listed = input.media ?? [];
  const referencedIds = [...listed.flatMap((item) => (item.url === undefined && item.mediaId !== undefined ? [item.mediaId] : [])), ...(input.mediaIds ?? [])];
  const uploaded = await resolveUploadedMedia(mediaLibrary, authorId, referencedIds);
  const media: PostMedia[] = listed.map((item) => {
    if (item.url !== undefined) return { url: item.url, type: item.type };
    const resolved = item.mediaId === undefined ? undefined : uploaded.get(item.mediaId);
    if (resolved === undefined) throw unprocessable("Each media item needs a url or a mediaId.");
    return resolved;
  });
  for (const mediaId of input.mediaIds ?? []) media.push(uploaded.get(mediaId) as PostMedia);
  if (media.length > MAX_POST_MEDIA) throw unprocessable(`A post can have at most ${MAX_POST_MEDIA} media items.`);
  return media;
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
    const media = await resolvePostMedia(this.postsService.dependencies.mediaLibrary, authorId, input);
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
