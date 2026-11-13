import assert from "node:assert/strict";
import test from "node:test";

import { buildBottomNavigationItems, isNavItemActive } from "./shellNavigation.config";

const counts = { cart: 2, chats: 3, notifications: 4 };

test("mobile web navigation follows the five primary React Native tabs", () => {
  for (const isSignedIn of [true, false]) {
    const items = buildBottomNavigationItems(isSignedIn, counts);
    assert.deepEqual(items.map((item) => item.href), ["/", "/clips", "/post/new", "/chats", isSignedIn ? "/me" : "/login"]);
  }
});

test("mobile navigation keeps unread message counts and marks nested routes active", () => {
  const items = buildBottomNavigationItems(true, counts);
  assert.equal(items.find((item) => item.href === "/chats")?.badgeCount, 3);
  assert.equal(isNavItemActive("/clips", "/clips/following"), true);
  assert.equal(isNavItemActive("/", "/clips"), false);
});
