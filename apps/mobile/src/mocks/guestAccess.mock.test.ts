import { guestAccessMocks } from "./guestAccess.mock";

describe("guest story access contract", () => {
  it("keeps the followed-story tray authenticated while allowing public user-story reads", () => {
    expect(guestAccessMocks.isAllowedWithoutSession("GET", "/api/v1/stories/tray", {})).toBe(false);
    expect(guestAccessMocks.isAllowedWithoutSession("GET", "/api/v1/users/:userId/stories", { userId: "public-user" })).toBe(true);
  });
});
