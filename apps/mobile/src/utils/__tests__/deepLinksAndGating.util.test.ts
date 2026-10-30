import { buildInternalRoute, readInternalNotificationTargetFromUrl, readInternalReferenceFromUrl } from "@/components/chat/chatLinks.util";
import { isBackgroundCallSkippedForGuests } from "@/config/guestAccess.config";
import { readProductIdFromSlug, webAppLinks } from "@/config/webAppLinks.config";

import { listCreateModesForViewer } from "../createMenu.util";

describe("profile share links", () => {
  it("use the web app domain and /username with no @", () => {
    expect(webAppLinks.profile("@ada.lovelace")).toBe("https://web.nantty.com/ada.lovelace");
    expect(webAppLinks.profile("tolu_1")).not.toContain("@");
  });

  it("build clean product slugs that round-trip to the id", () => {
    const link = webAppLinks.product({ id: "pr_f1", name: "Ankara Wrap Midi Dress" });
    expect(link).toBe("https://web.nantty.com/p/ankara-wrap-midi-dress-pr_f1");
    expect(readProductIdFromSlug("ankara-wrap-midi-dress-pr_f1")).toBe("pr_f1");
    expect(readProductIdFromSlug("shoe-0192f000-0000-7000-8000-000000000001")).toBe("0192f000-0000-7000-8000-000000000001");
  });
});

describe("internal link parsing", () => {
  it("opens /username links as profiles by username", () => {
    const reference = readInternalReferenceFromUrl("https://web.nantty.com/ada.lovelace");
    expect(reference).toEqual({ kind: "profile", id: "ada.lovelace" });
    expect(buildInternalRoute(reference!)).toEqual({ name: "UserProfileByUsername", params: { username: "ada.lovelace" } });
  });

  it("opens a shared order card on the order screen", () => {
    expect(buildInternalRoute({ kind: "order", id: "ord_1" })).toEqual({ name: "OrderDetail", params: { orderId: "ord_1" } });
  });

  it("reads products from /p/<slug>-<id> and ignores external hosts", () => {
    expect(readInternalReferenceFromUrl("https://web.nantty.com/p/ankara-wrap-midi-dress-pr_f1")).toEqual({ kind: "product", id: "pr_f1" });
    expect(readInternalReferenceFromUrl("https://evil.example/ada")).toBeNull();
  });

  it("preserves the exact post comment or clip comment target from internal notification URLs", () => {
    expect(readInternalNotificationTargetFromUrl("/post/p1?comment=c1")).toEqual({ reference: { kind: "post", id: "p1" }, commentId: "c1" });
    expect(readInternalNotificationTargetFromUrl("https://web.nantty.com/clips/v1?comment=c2")).toEqual({ reference: { kind: "clip", id: "v1" }, commentId: "c2" });
  });

  it("preserves a group chat and exact message target but rejects untrusted origins", () => {
    expect(readInternalNotificationTargetFromUrl("/chats/conversation-1?message=message-7")).toEqual({ reference: null, conversationId: "conversation-1", messageId: "message-7" });
    expect(readInternalNotificationTargetFromUrl("https://evil.example/chats/c1?message=m1")).toBeNull();
  });
});

describe("create menu", () => {
  it("shows Product only to approved sellers and Live only to approved creators", () => {
    expect(listCreateModesForViewer(false, false)).toEqual(["story", "post", "clip"]);
    expect(listCreateModesForViewer(true, false)).toEqual(["story", "post", "clip", "product"]);
    expect(listCreateModesForViewer(false, true)).toEqual(["story", "post", "clip", "live", "space"]);
  });
});

describe("guest background calls", () => {
  it("skips telemetry mutations for guests but never reads or user actions", () => {
    expect(isBackgroundCallSkippedForGuests("POST", "/api/v1/lives/l1/join")).toBe(true);
    expect(isBackgroundCallSkippedForGuests("POST", "/api/v1/stories/s1/seen")).toBe(true);
    expect(isBackgroundCallSkippedForGuests("GET", "/api/v1/lives/l1")).toBe(false);
    expect(isBackgroundCallSkippedForGuests("POST", "/api/v1/posts/p1/like")).toBe(false);
  });
});
