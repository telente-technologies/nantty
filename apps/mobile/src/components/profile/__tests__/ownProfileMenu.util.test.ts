import { buildOwnProfileMenuItems, type OwnProfileMenuInput } from "../ownProfileMenu.util";

const base: OwnProfileMenuInput = {
  profile: { isSeller: false, isPrivate: false, verification: null },
  creatorEntry: { label: "Switch to creator account", route: "CreatorProgram", isLoading: false },
  pendingFollowRequests: 0,
};

const keys = (input: OwnProfileMenuInput) => buildOwnProfileMenuItems(input).map((item) => item.key);

test("public non-seller sees the personal hubs with Settings last", () => {
  expect(keys(base)).toEqual(["creator", "ads", "saved", "orders", "wallet", "verification", "settings"]);
});

test("seller dashboard only for sellers, first in the list", () => {
  expect(keys({ ...base, profile: { ...base.profile, isSeller: true } })[0]).toBe("seller");
});

test("follow requests for private accounts, with a count badge", () => {
  const items = buildOwnProfileMenuItems({ ...base, profile: { ...base.profile, isPrivate: true }, pendingFollowRequests: 3, hasMoreFollowRequests: true });
  expect(items.find((item) => item.key === "followRequests")).toMatchObject({ route: "FollowRequests", badge: "3+" });
  expect(buildOwnProfileMenuItems({ ...base, profile: { ...base.profile, isPrivate: true } }).find((item) => item.key === "followRequests")?.badge).toBeUndefined();
});

test("public account still sees follow requests while some are pending", () => {
  expect(keys({ ...base, pendingFollowRequests: 2 })).toContain("followRequests");
});

test("creator entry follows useCreatorEntry and disables while loading", () => {
  const creator = buildOwnProfileMenuItems({ ...base, creatorEntry: { label: "Creator tools", route: "CreatorDashboard", isLoading: true } })[0];
  expect(creator).toMatchObject({ label: "Creator tools", route: "CreatorDashboard", disabled: true });
});

test("verification label reflects the badge", () => {
  const label = (badgeVisible: boolean) =>
    buildOwnProfileMenuItems({ ...base, profile: { ...base.profile, verification: { badgeVisible } as never } }).find((item) => item.key === "verification")?.label;
  expect(label(false)).toBe("Get verified");
  expect(label(true)).toBe("Verification");
});

test("Ads opens the in-app Ads hub right after the creator entry, for everyone", () => {
  const items = buildOwnProfileMenuItems({ ...base, profile: { ...base.profile, id: "user-1" } });
  expect(items.map((item) => item.key).slice(0, 2)).toEqual(["creator", "ads"]);
  expect(items[1]).toMatchObject({ label: "Ads", route: "AdsHub" });
  expect(keys(base)).toContain("ads");
});
