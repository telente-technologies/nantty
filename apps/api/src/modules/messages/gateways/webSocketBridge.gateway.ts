import type { WebSocket } from "ws";

import { readWebSocketText, type WebSocketConnectionHandler } from "../../../integrations/websockets.integration.js";
import type { RealtimeHub } from "./realtimeHub.gateway.js";

export class WebSocketBridge implements WebSocketConnectionHandler {
  public constructor(private readonly hub: RealtimeHub, public readonly heartbeatSeconds: number) {}

  public acceptWebSocket(socket: WebSocket): void {
    const connection = this.hub.acceptSocket({
      send: (data) => socket.send(data),
      close: (code, reason) => socket.close(code, reason),
      countBufferedBytes: () => socket.bufferedAmount,
      sendPing: () => socket.ping(),
    });
    socket.on("message", (data, isBinary) => {
      if (isBinary) return;
      void this.hub.receiveText(connection, readWebSocketText(data));
    });
    socket.on("pong", () => this.hub.markAlive(connection));
    socket.on("close", () => this.hub.releaseConnection(connection));
  }

  public sweepConnections(): void {
    this.hub.sweepConnections();
  }

  public closeEverything(): void {
    this.hub.closeEverything();
  }
}
