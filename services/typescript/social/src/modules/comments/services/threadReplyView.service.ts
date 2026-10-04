import type { CommentView, ThreadReplyView } from "../models/comment.model.js";
import type { ThreadNodeSource, ThreadTreeNode } from "./commentThread.service.js";

export function toThreadReplyViews<T extends ThreadNodeSource>(nodes: readonly ThreadTreeNode<T>[], views: ReadonlyMap<string, CommentView>, postAuthorId: string, hasParentAbove: boolean): ThreadReplyView[] {
  return nodes.flatMap((tree, index): ThreadReplyView[] => {
    const view = views.get(tree.node.id);
    if (view === undefined) return [];
    const inlineReplies = toThreadReplyViews(tree.children, views, postAuthorId, true);
    return [{
      ...view,
      isPostAuthor: view.author.id === postAuthorId,
      connector: { depth: tree.relativeDepth, hasParentAbove: hasParentAbove && index === 0, hasChildBelow: inlineReplies.length > 0, isLastInChain: inlineReplies.length === 0 },
      inlineReplies,
      hasMoreReplies: tree.hasMoreReplies,
      continuesInThread: tree.continuesInThread,
    }];
  });
}

export function flattenThreadNodeSources<T extends ThreadNodeSource>(nodes: readonly ThreadTreeNode<T>[]): T[] {
  return nodes.flatMap((tree) => [tree.node, ...flattenThreadNodeSources(tree.children)]);
}
