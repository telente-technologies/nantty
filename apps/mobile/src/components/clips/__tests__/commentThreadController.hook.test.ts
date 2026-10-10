import { act, renderHook } from "@testing-library/react-native";
import { useEffect } from "react";

import type { Comment } from "@/types";

import { useCommentThreadController } from "../commentThreadController.hook";

jest.mock("@/services/content/postComments.service", () => ({ postCommentsService: {} }));
jest.mock("@/store/auth.store", () => ({ useAuthStore: (select: (state: { user: null }) => unknown) => select({ user: null }) }));
jest.mock("@/utils/crossPlatformAlert.util", () => ({ showAlertWithButtons: jest.fn() }));
jest.mock("@/utils/requireAuth.util", () => ({ requireAuthAfterClosingModal: jest.fn(), requireAuthThen: jest.fn() }));
jest.mock("../videoReply/videoReply.util", () => ({ canReplyWithVideo: () => false }));

const focusComment = {
  id: "c1",
  postId: "p1",
  parentCommentId: null,
  rootCommentId: null,
  author: { id: "u2", name: "Ada", username: "ada", avatarUrl: null, verified: false },
  text: "hi",
  createdAt: "2026-10-10T00:00:00.000Z",
  likes: 0,
  liked: false,
  bookmarked: false,
  replyCount: 0,
} as Comment;

describe("useCommentThreadController", () => {
  it("keeps its setters stable so effects that depend on them do not loop", async () => {
    let renders = 0;
    const { result } = await renderHook(() => {
      renders += 1;
      const controller = useCommentThreadController("p1");
      const { setReplyThreadVisibility, startReplyingToComment, replyTarget } = controller;
      useEffect(() => setReplyThreadVisibility("c1", "expanded"), [setReplyThreadVisibility]);
      useEffect(() => {
        if (!replyTarget) startReplyingToComment(focusComment);
      }, [replyTarget, startReplyingToComment]);
      return controller;
    });
    expect(renders).toBeLessThan(10);
    expect(result.current.replyThreadVisibilityFor("c1")).toBe("expanded");
    expect(result.current.replyTarget?.id).toBe("c1");

    const before = renders;
    await act(async () => result.current.setReplyThreadVisibility("c1", "expanded"));
    await act(async () => result.current.startReplyingToComment(focusComment));
    expect(renders).toBeLessThanOrEqual(before + 2);
  });
});
