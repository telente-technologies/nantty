import { act, renderHook } from "@testing-library/react-native";

import type { Comment } from "@/types";

import { useCommentThreadController } from "../commentThreadController.hook";

const mockHideComment = jest.fn();
const mockShowAlert = jest.fn();
jest.mock("@/services/content/postComments.service", () => ({ postCommentsService: { hideComment: (...args: unknown[]) => mockHideComment(...args) } }));
jest.mock("@/store/auth.store", () => ({ useAuthStore: (select: (state: { user: unknown }) => unknown) => select({ user: { id: "owner", name: "Owner", username: "owner", avatarUrl: null, verified: false } }) }));
jest.mock("@/utils/crossPlatformAlert.util", () => ({ showAlertWithButtons: (...args: unknown[]) => mockShowAlert(...args) }));
jest.mock("@/utils/requireAuth.util", () => ({ requireAuthAfterClosingModal: jest.fn(), requireAuthThen: jest.fn() }));
jest.mock("../videoReply/videoReply.util", () => ({ canReplyWithVideo: () => false }));

const commentBy = (id: string, authorId: string) => ({
  id, postId: "p1", parentCommentId: null, rootCommentId: null, author: { id: authorId, name: authorId, username: authorId, avatarUrl: null, verified: false },
  text: "hi", createdAt: "2026-10-10T00:00:00.000Z", likes: 0, liked: false, bookmarked: false, replyCount: 0,
}) as Comment;

describe("hiding comments from the thread controller", () => {
  beforeEach(() => {
    mockHideComment.mockReset();
    mockShowAlert.mockReset();
  });

  it("lets only the post author hide other people's comments and drops the row at once", async () => {
    mockHideComment.mockResolvedValue({ hidden: true });
    const { result } = await renderHook(() => useCommentThreadController("p1", undefined, undefined, "owner"));
    expect(result.current.canHideComment(commentBy("c1", "fan"))).toBe(true);
    expect(result.current.canHideComment(commentBy("c2", "owner"))).toBe(false);
    await act(async () => result.current.hideComment(commentBy("c1", "fan")));
    expect(mockHideComment).toHaveBeenCalledWith("p1", "c1");
    expect(result.current.isCommentDeleted("c1")).toBe(true);
    const asViewer = await renderHook(() => useCommentThreadController("p1", undefined, undefined, "someone-else"));
    expect(asViewer.result.current.canHideComment(commentBy("c1", "fan"))).toBe(false);
  });

  it("brings the row back and explains when hiding fails", async () => {
    mockHideComment.mockRejectedValue(new Error("offline"));
    const { result } = await renderHook(() => useCommentThreadController("p1", undefined, undefined, "owner"));
    await act(async () => result.current.hideComment(commentBy("c1", "fan")));
    expect(result.current.isCommentDeleted("c1")).toBe(false);
    expect(mockShowAlert).toHaveBeenCalledWith("Could not hide comment", "Please try again.");
  });
});
