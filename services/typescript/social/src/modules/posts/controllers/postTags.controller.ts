import type { Handler } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { RemoveOwnPostTagCommand } from "../commands/removeOwnPostTag/removeOwnPostTag.command.js";
import type { SetPostTagsCommand } from "../commands/setPostTags/setPostTags.command.js";
import type { TaggingSettingsView, UpdateTaggingSettingsCommand } from "../commands/updateTaggingSettings/updateTaggingSettings.handler.js";
import type { PostView, TaggedUserView } from "../models/post.model.js";
import type { ListPostTaggedUsersQuery } from "../queries/listPostTaggedUsers/listPostTaggedUsers.query.js";
import type { ListTagCandidatesQuery } from "../queries/listTagCandidates/listTagCandidates.query.js";
import type { TagCandidatesResponse } from "../queries/listTagCandidates/listTagCandidates.handler.js";
import { tagCandidatesQuerySchema, postIdParamsSchema, setPostTagsBodySchema, taggedUsersQuerySchema, taggingSettingsBodySchema } from "../validators/posts.validator.js";

export interface PostTagsHandlers {
  readonly setPostTags: Handler<SetPostTagsCommand, PostView>;
  readonly removeOwnPostTag: Handler<RemoveOwnPostTagCommand, void>;
  readonly listPostTaggedUsers: Handler<ListPostTaggedUsersQuery, Page<TaggedUserView>>;
  readonly listTagCandidates: Handler<ListTagCandidatesQuery, TagCandidatesResponse>;
  readonly getTaggingSettings: Handler<{ readonly accountId: string }, TaggingSettingsView>;
  readonly updateTaggingSettings: Handler<UpdateTaggingSettingsCommand, TaggingSettingsView>;
}

export function createPostTagsController(route: RouteFactory, handlers: PostTagsHandlers) {
  return {
    setPostTags: route({ authentication: "required", params: postIdParamsSchema, body: setPostTagsBodySchema }, ({ principal, params, body }) =>
      handlers.setPostTags({ actorId: principal.accountId, postId: params.postId, taggedUserIds: body.taggedUserIds })),
    removeOwnTag: route({ authentication: "required", params: postIdParamsSchema }, ({ principal, params }) => handlers.removeOwnPostTag({ actorId: principal.accountId, postId: params.postId })),
    listTaggedUsers: route({ authentication: "optional", params: postIdParamsSchema, query: taggedUsersQuerySchema }, ({ principal, params, query }) =>
      handlers.listPostTaggedUsers({ viewerId: principal?.accountId, postId: params.postId, cursor: query.cursor, limit: clampPageSize(query.limit, 20) })),
    listCandidates: route({ authentication: "required", query: tagCandidatesQuerySchema }, ({ principal, query }) =>
      handlers.listTagCandidates({ viewerId: principal.accountId, term: query.q, cursor: query.cursor, limit: clampPageSize(query.limit, 20) })),
    getSettings: route({ authentication: "required" }, ({ principal }) => handlers.getTaggingSettings({ accountId: principal.accountId })),
    updateSettings: route({ authentication: "required", body: taggingSettingsBodySchema }, ({ principal, body }) =>
      handlers.updateTaggingSettings({ accountId: principal.accountId, allowTagging: body.allowTagging })),
  };
}
