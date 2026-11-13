import assert from "node:assert/strict";
import test from "node:test";

import { getBottomNavigationHrefs, isNavItemActive } from "./shellNavigation.routes";

test("mobile web navigation follows the five primary React Native tabs", () => {
  for (const isSignedIn of [true, false]) {
    assert.deepEqual(getBottomNavigationHrefs(isSignedIn), ["/", "/clips", "/post/new", "/chats", isSignedIn ? "/me" : "/login"]);
  }
});

test("mobile navigation marks nested destinations active without treating Home as every route", () => {
  assert.equal(isNavItemActive("/clips", "/clips/following"), true);
  assert.equal(isNavItemActive("/", "/clips"), false);
});
