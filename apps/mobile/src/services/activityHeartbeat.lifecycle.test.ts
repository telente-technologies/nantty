import { startActivityHeartbeatLifecycle, type ActivityHeartbeatLifecycleDependencies } from "./activityHeartbeat.lifecycle";

describe("mobile activity heartbeat lifecycle", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function setup(initiallyAuthenticated = true, initialAppState: "active" | "background" = "active") {
    let isAuthenticated = initiallyAuthenticated;
    let appState = initialAppState;
    let appStateListener: ((state: "active" | "background") => void) | undefined;
    let authListener: ((authenticated: boolean) => void) | undefined;
    const send = jest.fn().mockResolvedValue(undefined);
    const unsubscribeAppState = jest.fn();
    const unsubscribeAuth = jest.fn();
    const dependencies: ActivityHeartbeatLifecycleDependencies = {
      isAuthenticated: () => isAuthenticated,
      getAppState: () => appState,
      subscribeToAppState: (listener) => { appStateListener = listener; return unsubscribeAppState; },
      subscribeToAuth: (listener) => { authListener = listener; return unsubscribeAuth; },
      send,
      getTimeZone: () => "Africa/Lagos",
      now: Date.now,
      setInterval,
      clearInterval,
    };
    const stop = startActivityHeartbeatLifecycle(dependencies);
    return {
      send,
      stop,
      setAppState: (next: "active" | "background") => { appState = next; appStateListener?.(next); },
      setAuthenticated: (next: boolean) => { isAuthenticated = next; authListener?.(next); },
      unsubscribeAppState,
      unsubscribeAuth,
    };
  }

  it("sends on authenticated foreground entry and periodically, with timezone only", async () => {
    const lifecycle = setup();
    expect(lifecycle.send).toHaveBeenCalledTimes(1);
    expect(lifecycle.send).toHaveBeenCalledWith("Africa/Lagos");
    await jest.advanceTimersByTimeAsync(15 * 60_000);
    expect(lifecycle.send).toHaveBeenCalledTimes(2);
    lifecycle.stop();
  });

  it("deduplicates rapid app foreground transitions and pauses while backgrounded", async () => {
    const lifecycle = setup();
    await Promise.resolve();
    await Promise.resolve();
    lifecycle.setAppState("background");
    await jest.advanceTimersByTimeAsync(10_000);
    lifecycle.setAppState("active");
    expect(lifecycle.send).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(15 * 60_000);
    expect(lifecycle.send).toHaveBeenCalledTimes(2);
    lifecycle.stop();
  });

  it("does not send for guests and removes subscriptions and timers on cleanup", async () => {
    const lifecycle = setup(false);
    expect(lifecycle.send).not.toHaveBeenCalled();
    lifecycle.setAuthenticated(true);
    expect(lifecycle.send).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    lifecycle.stop();
    expect(lifecycle.unsubscribeAppState).toHaveBeenCalledTimes(1);
    expect(lifecycle.unsubscribeAuth).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(15 * 60_000);
    expect(lifecycle.send).toHaveBeenCalledTimes(1);
  });

  it("stops scheduling heartbeats immediately after logout", async () => {
    const lifecycle = setup();
    await Promise.resolve();
    await Promise.resolve();
    lifecycle.setAuthenticated(false);
    jest.advanceTimersByTime(30 * 60_000);
    expect(lifecycle.send).toHaveBeenCalledTimes(1);
    lifecycle.stop();
  });
});
