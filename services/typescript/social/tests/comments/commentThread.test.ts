import { describe, expect, it } from "vitest";

import { commentThreadRepository } from "../../src/modules/comments/repositories/commentThread.repository.js";
import { assembleThreadTree, descendantPathPrefix, layoutThreadDepthFirst, placeReplyUnderParent, type ThreadNodeSource } from "../../src/modules/comments/services/commentThread.service.js";
import { flattenThreadNodeSources } from "../../src/modules/comments/services/threadReplyView.service.js";
import type { Db } from "../../src/types/database.type.js";

function buildChain(length: number): ThreadNodeSource[] {
  const nodes: ThreadNodeSource[] = [];
  let parent: ThreadNodeSource | null = null;
  for (let index = 0; index < length; index += 1) {
    const placement = placeReplyUnderParent(parent);
    const node: ThreadNodeSource = { id: `c${String(index).padStart(2, "0")}`, ...placement, replyCount: index < length - 1 ? 1 : 0 };
    nodes.push(node);
    parent = node;
  }
  return nodes;
}

describe("deep comment threads", () => {
  it("stores parent, root, depth and a materialised path at any depth", () => {
    const chain = buildChain(12);
    const deepest = chain[11] as ThreadNodeSource;
    expect(deepest.depth).toBe(11);
    expect(deepest.rootCommentId).toBe("c00");
    expect(deepest.parentCommentId).toBe("c10");
    expect(deepest.path.split("/")).toHaveLength(11);
    expect(descendantPathPrefix(deepest)).toBe(`${deepest.path}/c11`);
    expect(placeReplyUnderParent(null)).toEqual({ parentCommentId: null, rootCommentId: null, depth: 0, path: "" });
  });

  it("lays a thread out depth first and hands off deeper replies to a drill-in", () => {
    const chain = buildChain(8);
    const sibling: ThreadNodeSource = { id: "c01b", ...placeReplyUnderParent(chain[0] as ThreadNodeSource), replyCount: 2 };
    const layout = layoutThreadDepthFirst(chain[0] as ThreadNodeSource, [...chain.slice(1), sibling], 3);
    expect(layout.map((node) => [node.id, node.relativeDepth])).toEqual([["c01", 1], ["c02", 2], ["c03", 3], ["c01b", 1]]);
    expect(layout.find((node) => node.id === "c03")?.continuesInThread).toBe(true);
    expect(layout.find((node) => node.id === "c01b")?.hasMoreReplies).toBe(true);
    const drillIn = layoutThreadDepthFirst(chain[3] as ThreadNodeSource, chain.slice(4), 3);
    expect(drillIn.map((node) => node.id)).toEqual(["c04", "c05", "c06"]);
  });

  it("loads a subtree with one indexed query bounded by root, path prefix and depth", async () => {
    const calls: unknown[] = [];
    const db = { comment: { findMany: async (args: unknown) => (calls.push(args), []) } } as unknown as Db;
    const chain = buildChain(5);
    await commentThreadRepository.descendantsWithinDepth(db, undefined, chain[2] as ThreadNodeSource, [chain[3] as ThreadNodeSource], 5);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ where: { rootCommentId: "c00", depth: { lte: 5 }, AND: [{ hiddenAt: null }], OR: [{ path: { startsWith: "c00/c01/c02/c03" } }] }, orderBy: [{ depth: "asc" }, { id: "asc" }] });
    await commentThreadRepository.allDescendantIds(db, chain[0] as ThreadNodeSource);
    expect(calls[1]).toMatchObject({ where: { rootCommentId: "c00", path: { startsWith: "c00" } } });
  });

  it("nests loaded replies into a tree and flags the drill-in point", () => {
    const chain = buildChain(6);
    const tree = assembleThreadTree([chain[1] as ThreadNodeSource], chain.slice(2), { baseDepth: 0, maximumRelativeDepth: 3 });
    expect(flattenThreadNodeSources(tree).map((node) => node.id)).toEqual(["c01", "c02", "c03"]);
    expect(tree[0]?.children[0]?.children[0]?.continuesInThread).toBe(true);
    const preview = assembleThreadTree([chain[0] as ThreadNodeSource], chain.slice(1), { baseDepth: 0, maximumRelativeDepth: 2, chooseChildren: (children) => children.slice(0, 1) });
    expect(preview[0]?.children[0]?.children[0]?.relativeDepth).toBe(2);
  });
});
