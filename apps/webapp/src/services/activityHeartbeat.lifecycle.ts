import { sendRequestToWebappServer } from "@/services/clientApi.service";

const HEARTBEAT_INTERVAL_MS = 15 * 60_000;
const TRANSITION_DEDUPE_MS = 60_000;

type LifecycleEvent = "focus" | "blur" | "visibilitychange";

export interface ActivityHeartbeatLifecycleEnvironment {
  readonly isForeground: () => boolean;
  readonly addEventListener: (event: LifecycleEvent, listener: () => void) => void;
  readonly removeEventListener: (event: LifecycleEvent, listener: () => void) => void;
  readonly send: (timeZone: string) => Promise<unknown>;
  readonly getTimeZone: () => string;
  readonly now: () => number;
  readonly setInterval: (callback: () => void, delay: number) => ReturnType<typeof setInterval>;
  readonly clearInterval: (timer: ReturnType<typeof setInterval>) => void;
}

function createBrowserEnvironment(): ActivityHeartbeatLifecycleEnvironment {
  return {
    isForeground: () => document.visibilityState === "visible" && document.hasFocus(),
    addEventListener: (event, listener) => {
      if (event === "visibilitychange") document.addEventListener(event, listener);
      else window.addEventListener(event, listener);
    },
    removeEventListener: (event, listener) => {
      if (event === "visibilitychange") document.removeEventListener(event, listener);
      else window.removeEventListener(event, listener);
    },
    send: (timeZone) => sendRequestToWebappServer<void>("/api/v1/notifications/activity", { method: "POST", body: { timeZone } }),
    getTimeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    now: Date.now,
    setInterval,
    clearInterval,
  };
}

export function startActivityHeartbeatLifecycle(environment = createBrowserEnvironment()): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastAttemptAt = Number.NEGATIVE_INFINITY;
  let inFlight = false;
  let stopped = false;

  const heartbeat = () => {
    if (stopped || inFlight || !environment.isForeground()) return;
    const now = environment.now();
    if (now - lastAttemptAt < TRANSITION_DEDUPE_MS) return;
    lastAttemptAt = now;
    inFlight = true;
    try {
      void environment.send(environment.getTimeZone()).catch(() => undefined).finally(() => { inFlight = false; });
    } catch {
      inFlight = false;
    }
  };

  const stopTimer = () => {
    if (timer === null) return;
    environment.clearInterval(timer);
    timer = null;
  };

  const reconcile = () => {
    if (stopped || !environment.isForeground()) {
      stopTimer();
      return;
    }
    if (timer !== null) return;
    heartbeat();
    timer = environment.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
  };

  const onLifecycleChange = () => reconcile();
  const events: readonly LifecycleEvent[] = ["focus", "blur", "visibilitychange"];
  events.forEach((event) => environment.addEventListener(event, onLifecycleChange));
  reconcile();

  return () => {
    if (stopped) return;
    stopped = true;
    stopTimer();
    events.forEach((event) => environment.removeEventListener(event, onLifecycleChange));
  };
}
