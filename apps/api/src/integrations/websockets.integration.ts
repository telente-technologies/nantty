import { WebSocketServer, type WebSocket } from "ws";

import type { Integration } from "./lifecycle.integration.js";

let server: WebSocketServer | undefined;

/** The WebSocket server. Throws before the runtime has started. */
export function websockets(): WebSocketServer {
  if (server === undefined) {
    throw new Error("The WebSocket server is not running: start the runtime first.");
  }
  return server;
}

/** Sends `data` to every open connection. */
export function broadcast(data: string): void {
  for (const socket of websockets().clients) {
    if (socket.readyState === socket.OPEN) socket.send(data);
  }
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
      // Example handler: echo each message back. Replace with your protocol.
      socket.on("message", (data) => socket.send(data.toString()));
    });
  },

  async drain() {
    for (const socket of server?.clients ?? []) socket.close(1001, "Server shutting down");
  },

  async stop() {
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
