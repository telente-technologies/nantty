import { AppState, type AppStateStatus } from "react-native";

import { api } from "@/services/core/apiClient.service";
import { useAuthStore } from "@/store/auth.store";

const HEARTBEAT_INTERVAL_MS = 15 * 60_000;
const TRANSITION_DEDUPE_MS = 60_000;

export type ActivityHeartbeatLifecycleDependencies = {
  readonly isAuthenticated: () => boolean;
  readonly getAppState: () => AppStateStatus | null;
  readonly subscribeToAppState: (listener: (state: AppStateStatus) => void) => () => void;
  readonly subscribeToAuth: (listener: (isAuthenticated: boolean) => void) => () => void;
  readonly send: (timeZone: string) => Promise<unknown>;
  readonly getTimeZone: () => string;
  readonly now: () => number;
  readonly setInterval: (callback: () => void, delay: number) => ReturnType<typeof setInterval>;
  readonly clearInterval: (timer: ReturnType<typeof setInterval>) => void;
};

function createDefaultDependencies(): ActivityHeartbeatLifecycleDependencies {
  return {
    isAuthenticated: () => useAuthStore.getState().status === "signedIn",
    getAppState: () => AppState.currentState as AppStateStatus | null,
    subscribeToAppState: (listener) => {
      const subscription = AppState.addEventListener("change", listener);
      return () => subscription.remove();
    },
    subscribeToAuth: (listener) => useAuthStore.subscribe((state, previous) => {
      const isAuthenticated = state.status === "signedIn";
      if (isAuthenticated !== (previous.status === "signedIn")) listener(isAuthenticated);
    }),
    send: (timeZone) => api.post("/api/v1/notifications/activity", { timeZone }),
    getTimeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    now: Date.now,
    setInterval,
    clearInterval,
  };
}

export function startActivityHeartbeatLifecycle(dependencies: ActivityHeartbeatLifecycleDependencies = createDefaultDependencies()): () => void {
  let currentAppState = dependencies.getAppState();
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastAttemptAt = Number.NEGATIVE_INFINITY;
  let inFlight = false;
  let stopped = false;

  const stopTimer = () => {
    if (timer === null) return;
    dependencies.clearInterval(timer);
    timer = null;
  };

  const heartbeat = () => {
    if (stopped || currentAppState !== "active" || !dependencies.isAuthenticated()) return;
    if (inFlight) return;
    const now = dependencies.now();
    if (now - lastAttemptAt < TRANSITION_DEDUPE_MS) return;
    lastAttemptAt = now;
    inFlight = true;
    try {
      void dependencies.send(dependencies.getTimeZone()).catch(() => undefined).finally(() => { inFlight = false; });
    } catch {
      inFlight = false;
    }
  };

  const reconcile = () => {
    if (stopped || currentAppState !== "active" || !dependencies.isAuthenticated()) {
      stopTimer();
      return;
    }
    if (timer !== null) return;
    heartbeat();
    timer = dependencies.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
  };

  const unsubscribeAppState = dependencies.subscribeToAppState((state) => {
    currentAppState = state;
    reconcile();
  });
  const unsubscribeAuth = dependencies.subscribeToAuth(() => reconcile());
  reconcile();

  return () => {
    if (stopped) return;
    stopped = true;
    stopTimer();
    unsubscribeAppState();
    unsubscribeAuth();
  };
}
