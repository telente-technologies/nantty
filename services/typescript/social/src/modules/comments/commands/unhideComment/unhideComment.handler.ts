import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { CommentHiddenState } from "../../models/comment.model.js";
import { setCommentHidden } from "../../services/commentHiding.service.js";
import type { UnhideCommentCommand } from "./unhideComment.command.js";

export function createUnhideCommentHandler(context: HandlerContext): Handler<UnhideCommentCommand, CommentHiddenState> {
  return (command) => setCommentHidden(context, command, false);
}
