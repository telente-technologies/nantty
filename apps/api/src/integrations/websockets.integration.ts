import { WebSocketServer, type RawData, type WebSocket } from "ws";

import type { Integration } from "./lifecycle.integration.js";

export interface WebSocketConnectionHandler {
  acceptWebSocket(socket: WebSocket): void;
  sweepConnections(): void;
  closeEverything(): void;
  readonly heartbeatSeconds: number;
}

let server: WebSocketServer | undefined;
let connectionHandler: WebSocketConnectionHandler | undefined;
let sweepTimer: NodeJS.Timeout | undefined;

export function websockets(): WebSocketServer {
  if (server === undefined) {
    throw new Error("The WebSocket server is not running: start the runtime first.");
  }
  return server;
}

export function useWebSocketConnectionHandler(handler: WebSocketConnectionHandler): void {
  connectionHandler = handler;
}

export function readWebSocketText(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return Buffer.from(data as ArrayBuffer).toString("utf8");
}

export const websocketsIntegration: Integration = {
  name: "websockets",

  async start({ config, httpServer, logger }) {
    if (httpServer === undefined) {
      throw new Error("WebSockets need the HTTP server: pass httpServer to createApp().");
    }
    const allowed = new Set(config.corsOrigins);
    server = new WebSocketServer({
      server: httpServer,
      path: config.websockets.path,
      maxPayload: 64 * 1024,
      // A browser always sends Origin; refuse pages from origins not in
      // CORS_ORIGINS. Clients without Origin are not browsers.
      verifyClient: ({ origin }: { origin?: string }) =>
        origin === undefined || origin === "" || allowed.has(origin),
    });
    server.on("connection", (socket: WebSocket) => {
      socket.on("error", (error: Error) => logger.warn("WebSocket error", { error }));
      if (connectionHandler === undefined) {
        socket.close(1013, "Realtime is not available");
        return;
      }
      connectionHandler.acceptWebSocket(socket);
    });
    const heartbeatMs = (connectionHandler?.heartbeatSeconds ?? 30) * 1000;
    sweepTimer = setInterval(() => connectionHandler?.sweepConnections(), heartbeatMs);
    sweepTimer.unref();
  },

  async drain() {
    connectionHandler?.closeEverything();
    for (const socket of server?.clients ?? []) socket.close(1001, "Server shutting down");
  },

  async stop() {
    if (sweepTimer !== undefined) clearInterval(sweepTimer);
    sweepTimer = undefined;
    const current = server;
    server = undefined;
    if (current === undefined) return;
    for (const socket of current.clients) socket.terminate();
    await new Promise<void>((resolve) => current.close(() => resolve()));
  },

  async health() {
    return server !== undefined;
  },
};
