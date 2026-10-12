import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { CommentHiddenState } from "../../models/comment.model.js";
import { setCommentHidden } from "../../services/commentHiding.service.js";
import type { HideCommentCommand } from "./hideComment.command.js";

export function createHideCommentHandler(context: HandlerContext): Handler<HideCommentCommand, CommentHiddenState> {
  return (command) => setCommentHidden(context, command, true);
}
