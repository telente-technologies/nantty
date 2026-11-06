import { navigationStateFromNotification } from "../notificationRoute.util";

const focusedRouteName = (payload: unknown) => {
  const state = navigationStateFromNotification(payload);
  if (state === null) return null;
  let current = state;
  while (current.routes[current.index ?? current.routes.length - 1]?.state) {
    current = current.routes[current.index ?? current.routes.length - 1]!.state as typeof state;
  }
  return current.routes[current.index ?? current.routes.length - 1]?.name ?? null;
};

describe("notification route validation", () => {
  it("resolves known internal routes from push data", () => {
    expect(focusedRouteName({ url: "/post/post_42" })).toBe("PostDetail");
    expect(focusedRouteName({ data: { url: "/chats/invitations" } })).toBe("GroupInvitations");
    expect(focusedRouteName({ url: "/orders/order_42" })).toBe("OrderDetail");
    expect(focusedRouteName({ data: { url: "/spaces", screen: "SpaceInvitations" } })).toBe("Spaces");
    expect(focusedRouteName({ url: "https://web.nantty.com/live/live_42" })).toBe("Live");
    expect(focusedRouteName({ url: "nantty://post/post_42" })).toBe("PostDetail");
  });

  it("uses safe structured fallbacks for notification payloads that omit a URL", () => {
    expect(focusedRouteName({ data: { conversationId: "conversation-42" } })).toBe("Chat");
    expect(focusedRouteName({ data: { clipId: "clip-42", commentId: "comment-42" } })).toBe("CommentThread");
    expect(focusedRouteName({ data: { clipId: "clip-42" } })).toBe("Clips");
    expect(focusedRouteName({ data: { postId: "post-42", commentId: "comment-42" } })).toBe("CommentThread");
    expect(focusedRouteName({ data: { disputeId: "dispute-42" } })).toBe("DisputeDetail");
    expect(focusedRouteName({ data: { ticketId: "ticket-42" } })).toBe("SupportTicketDetail");
  });

  it.each([
    "https://attacker.example/phishing",
    "https://web.nantty.com/unmapped/private-screen",
    "//attacker.example/phishing",
    "/%2F%2Fattacker.example",
    "/post/%E0%A4%A",
    "/unknown/private-screen",
  ])("rejects unsafe or unmapped notification URL %s", (url) => {
    expect(navigationStateFromNotification({ url })).toBeNull();
  });

  it("accepts a valid nested cold-start response payload and preserves query parameters", () => {
    const state = navigationStateFromNotification({ notification: { request: { content: { data: { url: "/p/linen-top-0192f000-0000-7000-8000-000000000001?aff=affiliate-1" } } } } });
    expect(state).not.toBeNull();
    expect(focusedRouteName({ url: "/p/linen-top-0192f000-0000-7000-8000-000000000001?aff=affiliate-1" })).toBe("ProductDetail");
  });
});
