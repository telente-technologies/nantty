import { spaceAnnouncementDisplayText, spaceIdFromAnnouncement } from "../spaceAnnouncement.util";

describe("Space announcement copy", () => {
  const post = "Join my Space: A talk about art\nhttps://web.nantty.com/spaces/space-123";

  it("keeps the Space destination available for routing", () => {
    expect(spaceIdFromAnnouncement(post)).toBe("space-123");
  });

  it("hides the raw URL from the visible announcement text", () => {
    expect(spaceAnnouncementDisplayText(post)).toBe("Join my Space: A talk about art");
  });

  it("leaves ordinary posts unchanged", () => {
    expect(spaceAnnouncementDisplayText("A normal post with https://example.com")).toBe("A normal post with https://example.com");
  });
});
