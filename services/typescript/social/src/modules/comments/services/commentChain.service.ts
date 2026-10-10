export interface ChainCandidate {
  readonly id: string;
  readonly authorId: string;
  readonly parentCommentId: string | null;
  readonly likeCount: number;
  readonly replyCount: number;
}

export const maximumPreviewChainLength = 3;

function byEngagement(left: ChainCandidate, right: ChainCandidate): number {
  return right.likeCount - left.likeCount || right.replyCount - left.replyCount || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

function byOldest(left: ChainCandidate, right: ChainCandidate): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function chooseConversationChain<T extends ChainCandidate>(root: T, descendants: readonly T[], postAuthorId: string, maximumLength = maximumPreviewChainLength): T[] {
  const childrenByParent = new Map<string, T[]>();
  for (const node of descendants) {
    if (node.parentCommentId === null) continue;
    const siblings = childrenByParent.get(node.parentCommentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentCommentId, siblings);
  }
  const childrenOf = (id: string): T[] => [...(childrenByParent.get(id) ?? [])].sort(byOldest);
  const chain: T[] = [];
  const firstAuthorReply = root.authorId === postAuthorId ? undefined : childrenOf(root.id).find((child) => child.authorId === postAuthorId);
  if (firstAuthorReply !== undefined) {
    let current: T = firstAuthorReply;
    let expected = root.authorId;
    chain.push(current);
    while (chain.length < maximumLength) {
      const next = childrenOf(current.id).find((child) => child.authorId === expected);
      if (next === undefined) break;
      chain.push(next);
      current = next;
      expected = expected === root.authorId ? postAuthorId : root.authorId;
    }
    return chain;
  }
  const top = [...childrenOf(root.id)].sort(byEngagement)[0];
  if (top === undefined) return chain;
  chain.push(top);
  const authorReply = childrenOf(top.id).find((child) => child.authorId === postAuthorId);
  if (authorReply !== undefined && chain.length < maximumLength) chain.push(authorReply);
  return chain;
}
