import { getStateFromPath } from "@react-navigation/native";

import { deepLinking } from "../linking.config";

const focusedRouteNames = (path: string) => {
  const names: string[] = [];
  let state = getStateFromPath(path, deepLinking.config) as { routes: { name: string; state?: unknown }[]; index?: number } | undefined;
  while (state) {
    const route = state.routes[state.index ?? state.routes.length - 1]!;
    names.push(route.name);
    state = route.state as typeof state;
  }
  return names;
};

test("an old rankings link opens the profile tab instead of a removed screen", () => {
  expect(focusedRouteNames("rankings")).toEqual(["Tabs", "Me"]);
});

test("the profile tab link still works", () => {
  expect(focusedRouteNames("me")).toEqual(["Tabs", "Me"]);
});

test.each([
  ["orders/o_1042", ["OrderDetail"]],
  ["seller/dashboard", ["SellerDashboard"]],
  ["creator/dashboard", ["CreatorDashboard"]],
  ["stories/u_1", ["Story"]],
  ["live/live_ada", ["Live"]],
  ["spaces/space_demo_live", ["Spaces"]],
  ["spaces", ["Spaces"]],
  ["settings/widgets", ["SettingsWidgets"]],
])("the %s widget deep link opens the right screen", (path, expected) => {
  expect(focusedRouteNames(path)).toEqual(expected);
});

test("widget deep links never fall through to a username profile", () => {
  expect(focusedRouteNames("orders")).toEqual(["Orders"]);
  expect(focusedRouteNames("creator")).toEqual(["CreatorProgram"]);
});

test("a quote deep link opens the normal composer with the quoted post attached", () => {
  const state = getStateFromPath("create/post?quotePostId=post_42", deepLinking.config) as { routes: { name: string; params?: Record<string, unknown> }[] };
  const route = state.routes.at(-1)!;
  expect(route.name).toBe("CreatePost");
  expect(route.params).toMatchObject({ mode: "post", quotePostId: "post_42" });
});

test("an emailed offer link opens the web claim hand-off instead of a profile", () => {
  expect(focusedRouteNames("offer/Xq3v0mZp9bT2nR8kL5wA7cD1eF4gH6jK0lM2nP4qR6s")).toEqual(["SubscriptionOffer"]);
});

test("a creator's affiliate link opens the exact product and keeps the link id for attribution", () => {
  const state = getStateFromPath("p/ankara-dress-0192f000-0000-7000-8000-000000000001?aff=0192f000-0000-7000-8000-0000000000aa", deepLinking.config) as { routes: { name: string; params?: Record<string, string> }[] };
  const route = state.routes[state.routes.length - 1]!;
  expect(route.name).toBe("ProductDetail");
  expect(route.params).toEqual({ productId: "0192f000-0000-7000-8000-000000000001", aff: "0192f000-0000-7000-8000-0000000000aa" });
});

test("the creator affiliate workspace has its own link", () => {
  expect(focusedRouteNames("creator/affiliates")).toEqual(["CreatorAffiliates"]);
});
