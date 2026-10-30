import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runWithAsyncActionLock } from "./asyncActionLock.util";

describe("runWithAsyncActionLock", () => {
  it("allows only one overlapping action and releases after completion", async () => {
    const lock = { current: false };
    let release!: () => void;
    let calls = 0;
    const action = () => {
      calls += 1;
      return new Promise<number>((resolve) => {
        release = () => resolve(42);
      });
    };

    const first = runWithAsyncActionLock(lock, action);
    const second = await runWithAsyncActionLock(lock, action);
    assert.equal(second, undefined);
    assert.equal(calls, 1);

    release();
    assert.equal(await first, 42);
    assert.equal(lock.current, false);
    assert.equal(await runWithAsyncActionLock(lock, async () => 7), 7);
  });

  it("releases the lock when an action rejects", async () => {
    const lock = { current: false };
    await assert.rejects(runWithAsyncActionLock(lock, async () => { throw new Error("failed"); }), /failed/);
    assert.equal(lock.current, false);
  });
});
