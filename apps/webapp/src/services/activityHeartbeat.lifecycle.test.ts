import assert from "node:assert/strict";
import test from "node:test";

import { startActivityHeartbeatLifecycle, type ActivityHeartbeatLifecycleEnvironment } from "./activityHeartbeat.lifecycle";

function createEnvironment(initiallyForeground = true) {
  let foreground = initiallyForeground;
  let now = 1_000_000;
  const listeners = new Map<string, Set<() => void>>();
  const timers = new Map<ReturnType<typeof setInterval>, () => void>();
  const sentTimeZones: string[] = [];
  const environment: ActivityHeartbeatLifecycleEnvironment = {
    isForeground: () => foreground,
    addEventListener: (event, listener) => {
      const eventListeners = listeners.get(event) ?? new Set();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
    },
    removeEventListener: (event, listener) => { listeners.get(event)?.delete(listener); },
    send: async (timeZone) => { sentTimeZones.push(timeZone); },
    getTimeZone: () => "Africa/Lagos",
    now: () => now,
    setInterval: (callback) => {
      const handle = callback as unknown as ReturnType<typeof setInterval>;
      timers.set(handle, callback);
      return handle;
    },
    clearInterval: (handle) => { timers.delete(handle); },
  };
  return {
    environment,
    sentTimeZones,
    timers,
    listeners,
    setForeground: (value: boolean, event: "focus" | "blur" | "visibilitychange") => {
      foreground = value;
      for (const listener of listeners.get(event) ?? []) listener();
    },
    advance: (milliseconds: number) => { now += milliseconds; },
  };
}

test("web heartbeat sends on authenticated foreground and repeats conservatively", async () => {
  const fixture = createEnvironment();
  const stop = startActivityHeartbeatLifecycle(fixture.environment);
  assert.deepEqual(fixture.sentTimeZones, ["Africa/Lagos"]);
  await Promise.resolve();
  await Promise.resolve();

  fixture.advance(15 * 60_000);
  for (const callback of fixture.timers.values()) callback();
  assert.deepEqual(fixture.sentTimeZones, ["Africa/Lagos", "Africa/Lagos"]);
  stop();
});

test("web heartbeat pauses while hidden and deduplicates rapid focus transitions", async () => {
  const fixture = createEnvironment();
  const stop = startActivityHeartbeatLifecycle(fixture.environment);
  await Promise.resolve();
  fixture.setForeground(false, "blur");
  assert.equal(fixture.timers.size, 0);
  fixture.advance(10_000);
  fixture.setForeground(true, "focus");
  assert.equal(fixture.sentTimeZones.length, 1);
  await Promise.resolve();
  await Promise.resolve();

  fixture.advance(15 * 60_000);
  for (const callback of fixture.timers.values()) callback();
  assert.equal(fixture.sentTimeZones.length, 2);
  stop();
});

test("web heartbeat does not start when hidden and removes listeners and timer on cleanup", async () => {
  const fixture = createEnvironment(false);
  const stop = startActivityHeartbeatLifecycle(fixture.environment);
  assert.equal(fixture.sentTimeZones.length, 0);
  assert.equal(fixture.timers.size, 0);

  fixture.setForeground(true, "focus");
  assert.equal(fixture.sentTimeZones.length, 1);
  await Promise.resolve();
  await Promise.resolve();
  stop();
  assert.equal(fixture.timers.size, 0);
  assert.equal([...fixture.listeners.values()].reduce((count, eventListeners) => count + eventListeners.size, 0), 0);
});
