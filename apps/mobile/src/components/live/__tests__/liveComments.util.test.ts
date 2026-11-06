import type { LiveComment } from "@/types";
import { mergeLiveCommentPages, selectLatestLiveComments } from "../liveComments.util";

describe("selectLatestLiveComments", () => {
  it("keeps the latest twelve non-gift comments in chronological display order", () => {
    const newestFirst = Array.from({ length: 15 }, (_, index) => comment(15 - index)).map((row) =>
      row.id === "comment-14" ? { ...row, kind: "gift" as const } : row,
    );

    const visible = selectLatestLiveComments(newestFirst);

    expect(visible).toHaveLength(12);
    expect(visible.map((row) => row.id)).toEqual([
      "comment-3", "comment-4", "comment-5", "comment-6", "comment-7", "comment-8",
      "comment-9", "comment-10", "comment-11", "comment-12", "comment-13", "comment-15",
    ]);
  });

  it("returns no rows when the visible count is zero", () => {
    expect(selectLatestLiveComments([comment(1)], 0)).toEqual([]);
  });
});

describe("mergeLiveCommentPages", () => {
  it("deduplicates polling overlap, preserves newest-first order, and removes legacy gift rows", () => {
    const latest = [comment(4), comment(3), { ...comment(2), kind: "gift" as const }];
    const history = [[comment(3), comment(2), comment(1)]];

    expect(mergeLiveCommentPages(latest, history).map((row) => row.id)).toEqual([
      "comment-4", "comment-3", "comment-2", "comment-1",
    ]);
    expect(mergeLiveCommentPages(latest, history).some((row) => row.kind === "gift")).toBe(false);
  });

  it("keeps the latest-page version when a comment appears in both sources", () => {
    const fresh = { ...comment(7), text: "edited newest payload" };
    const merged = mergeLiveCommentPages([fresh], [[comment(7)]]);
    expect(merged).toEqual([fresh]);
  });
});

function comment(id: number): LiveComment {
  return {
    id: `comment-${id}`,
    author: { id: "user-1", name: "Viewer", username: "viewer", avatarUrl: null, verified: false },
    text: `Comment ${id}`,
    kind: "comment",
  };
}
