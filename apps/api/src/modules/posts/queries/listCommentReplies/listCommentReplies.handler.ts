import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { Page } from "../../../../types/pagination.type.js";
import type { CommentDto } from "../../dtos/posts.dto.js";
import { isCommentShownInThread } from "../../repositories/postInteractions.repository.js";
import type { PostsService } from "../../services/posts.service.js";
import type { ListCommentRepliesQuery } from "./listCommentReplies.query.js";

export class ListCommentRepliesHandler extends QueryHandler<ListCommentRepliesQuery, Page<CommentDto>> {
  public readonly queryType = "posts.listCommentReplies" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(query: ListCommentRepliesQuery): Promise<Page<CommentDto>> {
    const { interactions } = this.postsService.dependencies;
    const { comment } = await this.postsService.findCommentOnVisiblePostOrThrow(query.commentId, query.viewerId);
    if (!isCommentShownInThread(comment)) throw notFound("Comment");
    const page = comment.parentCommentId === null
      ? await interactions.listThreadReplies(comment.id, query.page)
      : await interactions.listDirectReplies(comment.id, query.page);
    return { data: await this.postsService.commentPresenter.presentComments(page.data, query.viewerId), nextCursor: page.nextCursor };
  }
}
