import { forbidden, notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { currentViewerAgeBracket } from "../../../../utils/viewerAgeContext.util.js";
import type { PostView } from "../../models/post.model.js";
import { postRepository } from "../../repositories/post.repository.js";
import { assertAuthorAgeAllowsSensitiveLabels } from "../../services/postAudienceRules.service.js";
import { buildPostViews } from "../../services/postView.service.js";
import { applySensitiveLabelChange } from "../../services/sensitiveLabelWrite.service.js";
import { normaliseSensitiveLabels } from "../../services/sensitiveContent.service.js";
import type { UpdatePostSensitivityCommand } from "./updatePostSensitivity.command.js";

export function createUpdatePostSensitivityHandler(context: HandlerContext): Handler<UpdatePostSensitivityCommand, PostView> {
  return async ({ actorId, postId, sensitiveLabels }) => {
    const post = await postRepository.findById(context.database.client, postId);
    if (post === null) throw notFound("POST_NOT_FOUND", "Post not found.");
    if (post.authorId !== actorId) throw forbidden("NOT_POST_AUTHOR", "Only the author can change content warnings.");
    const labels = normaliseSensitiveLabels(sensitiveLabels);
    assertAuthorAgeAllowsSensitiveLabels(currentViewerAgeBracket(), labels);
    await applySensitiveLabelChange(context, postId, { source: "author", labels }, context.clock.now());
    const refreshed = await postRepository.findById(context.database.client, postId);
    const [view] = await buildPostViews(context, actorId, refreshed === null ? [] : [refreshed]);
    return view as PostView;
  };
}
