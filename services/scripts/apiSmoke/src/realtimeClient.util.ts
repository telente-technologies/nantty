import { callApi, describeResponse } from "./apiClient.util.js";

export const realtimeUrl = process.env["SMOKE_REALTIME_URL"] ?? "ws://localhost:4000/ws";

export interface RealtimeFrame {
  readonly type: string;
  readonly receivedAt: number;
  readonly [key: string]: unknown;
}

export interface RealtimeClient {
  readonly frames: RealtimeFrame[];
  subscribe(topic: string): Promise<void>;
  waitForFrame(predicate: (frame: RealtimeFrame) => boolean, timeoutMs?: number): Promise<RealtimeFrame | undefined>;
  close(): void;
}

async function exchangeForRealtimeToken(accessToken: string): Promise<string> {
  const issued = await callApi("POST", "/api/v1/auth/realtime-token", { token: accessToken, idempotent: false });
  if (issued.status !== 200 || typeof issued.body?.realtimeToken !== "string") throw new Error(`realtime token: ${describeResponse(issued)}`);
  return issued.body.realtimeToken;
}

export async function connectRealtimeClient(accessToken: string): Promise<RealtimeClient> {
  const realtimeToken = await exchangeForRealtimeToken(accessToken);
  const socket = new WebSocket(realtimeUrl);
  const frames: RealtimeFrame[] = [];
  const waiters = new Set<() => void>();
  socket.addEventListener("message", (event) => {
    try {
      frames.push({ ...(JSON.parse(String(event.data)) as { type: string }), receivedAt: performance.now() });
    } catch {
      frames.push({ type: "unparseable", receivedAt: performance.now() });
    }
    for (const wake of waiters) wake();
  });
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", () => reject(new Error(`cannot connect to ${realtimeUrl}`)), { once: true });
  });
  const waitForFrame = (predicate: (frame: RealtimeFrame) => boolean, timeoutMs = 10_000) =>
    new Promise<RealtimeFrame | undefined>((resolve) => {
      const check = () => {
        const found = frames.find(predicate);
        if (found === undefined) return false;
        waiters.delete(wake);
        clearTimeout(timer);
        resolve(found);
        return true;
      };
      const wake = () => void check();
      const timer = setTimeout(() => {
        waiters.delete(wake);
        resolve(undefined);
      }, timeoutMs);
      waiters.add(wake);
      check();
    });
  socket.send(JSON.stringify({ type: "auth", accessToken: realtimeToken }));
  if ((await waitForFrame((frame) => frame.type === "auth.ok" || frame.type === "auth.failed"))?.type !== "auth.ok") throw new Error("realtime auth failed");
  return {
    frames,
    async subscribe(topic) {
      socket.send(JSON.stringify({ type: "subscribe", topic }));
      const reply = await waitForFrame((frame) => (frame.type === "subscribed" || frame.type === "error") && frame["topic"] === topic);
      if (reply?.type !== "subscribed") throw new Error(`subscribe ${topic}: ${JSON.stringify(reply)}`);
    },
    waitForFrame,
    close: () => socket.close(),
  };
}
