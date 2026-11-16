import assert from "node:assert/strict";
import test from "node:test";
import { shouldExecuteInteractiveNotificationAction } from "./notificationActions.util";

test("only enabled reply and mark-read actions execute", () => {
  assert.equal(shouldExecuteInteractiveNotificationAction("NANTTY_REPLY", true), true);
  assert.equal(shouldExecuteInteractiveNotificationAction("NANTTY_MARK_READ", true), true);
  assert.equal(shouldExecuteInteractiveNotificationAction("NANTTY_REPLY", false), false);
  assert.equal(shouldExecuteInteractiveNotificationAction("NANTTY_MARK_READ", false), false);
  assert.equal(shouldExecuteInteractiveNotificationAction("DEFAULT", true), false);
  assert.equal(shouldExecuteInteractiveNotificationAction("unknown", true), false);
});
