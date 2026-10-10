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
