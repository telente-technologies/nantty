export interface ThreadPlacementSource {
  readonly id: string;
  readonly rootCommentId: string | null;
  readonly depth: number;
  readonly path: string;
}

export interface ThreadPlacement {
  readonly parentCommentId: string | null;
  readonly rootCommentId: string | null;
  readonly depth: number;
  readonly path: string;
}

export interface ThreadNodeSource extends ThreadPlacementSource {
  readonly parentCommentId: string | null;
  readonly replyCount: number;
}

export interface ThreadNodeLayout {
  readonly id: string;
  readonly relativeDepth: number;
  readonly loadedReplyCount: number;
  readonly hasMoreReplies: boolean;
  readonly continuesInThread: boolean;
}

export function descendantPathPrefix(comment: Pick<ThreadPlacementSource, "id" | "path">): string {
  return comment.path === "" ? comment.id : `${comment.path}/${comment.id}`;
}

export function threadRootIdOf(comment: Pick<ThreadPlacementSource, "id" | "rootCommentId">): string {
  return comment.rootCommentId ?? comment.id;
}

export function placeReplyUnderParent(parent: ThreadPlacementSource | null): ThreadPlacement {
  if (parent === null) return { parentCommentId: null, rootCommentId: null, depth: 0, path: "" };
  return { parentCommentId: parent.id, rootCommentId: threadRootIdOf(parent), depth: parent.depth + 1, path: descendantPathPrefix(parent) };
}

export function layoutThreadDepthFirst(focus: ThreadPlacementSource, nodes: readonly ThreadNodeSource[], maximumRelativeDepth: number): ThreadNodeLayout[] {
  const childrenByParent = new Map<string, ThreadNodeSource[]>();
  for (const node of nodes) {
    if (node.parentCommentId === null) continue;
    const siblings = childrenByParent.get(node.parentCommentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentCommentId, siblings);
  }
  for (const siblings of childrenByParent.values()) siblings.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const ordered: ThreadNodeLayout[] = [];
  const visit = (node: ThreadNodeSource) => {
    const relativeDepth = node.depth - focus.depth;
    const children = relativeDepth < maximumRelativeDepth ? (childrenByParent.get(node.id) ?? []) : [];
    ordered.push({
      id: node.id,
      relativeDepth,
      loadedReplyCount: children.length,
      hasMoreReplies: relativeDepth < maximumRelativeDepth && node.replyCount > children.length,
      continuesInThread: relativeDepth >= maximumRelativeDepth && node.replyCount > 0,
    });
    for (const child of children) visit(child);
  };
  for (const child of childrenByParent.get(focus.id) ?? []) visit(child);
  return ordered;
}

export interface ThreadTreeNode<T extends ThreadNodeSource> {
  readonly node: T;
  readonly relativeDepth: number;
  readonly children: readonly ThreadTreeNode<T>[];
  readonly hasMoreReplies: boolean;
  readonly continuesInThread: boolean;
}

export interface ThreadTreeOptions<T extends ThreadNodeSource> {
  readonly baseDepth: number;
  readonly maximumRelativeDepth: number;
  readonly chooseChildren?: (children: readonly T[]) => readonly T[];
}

export function assembleThreadTree<T extends ThreadNodeSource>(topNodes: readonly T[], descendants: readonly T[], options: ThreadTreeOptions<T>): ThreadTreeNode<T>[] {
  const childrenByParent = new Map<string, T[]>();
  for (const node of descendants) {
    if (node.parentCommentId === null) continue;
    const siblings = childrenByParent.get(node.parentCommentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentCommentId, siblings);
  }
  const build = (node: T): ThreadTreeNode<T> => {
    const relativeDepth = node.depth - options.baseDepth;
    const canNest = relativeDepth < options.maximumRelativeDepth;
    const loaded = canNest ? [...(childrenByParent.get(node.id) ?? [])].sort((left, right) => (left.id < right.id ? -1 : 1)) : [];
    const chosen = options.chooseChildren === undefined ? loaded : options.chooseChildren(loaded);
    return {
      node,
      relativeDepth,
      children: chosen.map(build),
      hasMoreReplies: canNest && node.replyCount > chosen.length,
      continuesInThread: !canNest && node.replyCount > 0,
    };
  };
  return topNodes.map(build);
}
