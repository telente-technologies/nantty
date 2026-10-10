import { resolveMockApiRequest } from "@/mocks";
import type { Post } from "@/types";
import { canOfferPostNotificationMute, postNotificationMuteLabel } from "@/utils/postNotificationMute.util";

const mutePath = "/api/v1/posts/post_1/notifications-mute";
const failureOf = (request: Promise<unknown>) => request.then(() => undefined, (error: unknown) => error);

describe("post notification mute mocks", () => {
  it("mutes, survives a double toggle, reflects on the post and unmutes", async () => {
    expect(await resolveMockApiRequest("PUT", mutePath, undefined, "k1")).toEqual({ postId: "post_1", muted: true });
    expect(await resolveMockApiRequest("PUT", mutePath, undefined, "k2")).toEqual({ postId: "post_1", muted: true });
    expect((await resolveMockApiRequest<Post>("GET", "/api/v1/posts/post_1", undefined)).viewerNotificationsMuted).toBe(true);
    expect(await resolveMockApiRequest("GET", mutePath, undefined)).toEqual({ postId: "post_1", muted: true });
    await resolveMockApiRequest("DELETE", mutePath, undefined, "k3");
    await resolveMockApiRequest("DELETE", mutePath, undefined, "k4");
    expect((await resolveMockApiRequest<Post>("GET", "/api/v1/posts/post_1", undefined)).viewerNotificationsMuted).toBe(false);
  });

  it("rejects guests and unknown posts", async () => {
    expect(await failureOf(resolveMockApiRequest("PUT", mutePath, undefined, "k5", true))).toMatchObject({ status: 401 });
    expect(await failureOf(resolveMockApiRequest("PUT", "/api/v1/posts/nope_404/notifications-mute", undefined, "k6"))).toMatchObject({ status: 404 });
  });

  it("only offers the menu item to signed-in viewers on organic posts", () => {
    expect(canOfferPostNotificationMute(false, {})).toBe(false);
    expect(canOfferPostNotificationMute(true, { sponsored: { label: "Sponsored" } })).toBe(false);
    expect(canOfferPostNotificationMute(true, { sponsored: null })).toBe(true);
    expect(postNotificationMuteLabel(true)).toBe("Turn on notifications for this post");
    expect(postNotificationMuteLabel(false)).toBe("Turn off notifications for this post");
  });
});
