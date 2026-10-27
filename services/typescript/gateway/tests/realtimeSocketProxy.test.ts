import { createServer, request, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Duplex } from "node:stream";

import { createLogger } from "@nantty/fastify-platform";
import { afterEach, describe, expect, it } from "vitest";

import { attachRealtimeSocketProxy, isRealtimeSocketPath } from "../src/services/realtimeSocketProxy.service.js";

const servers: Server[] = [];
const sockets = new Set<Duplex>();
const logger = createLogger({ name: "test", level: "error" });

async function listen(server: Server): Promise<number> {
  servers.push(server);
  server.on("connection", (socket) => sockets.add(socket));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return (server.address() as AddressInfo).port;
}

function echoingRealtime(): Server {
  const server = createServer((_request, response) => response.writeHead(426).end());
  server.on("upgrade", (incoming: IncomingMessage, socket: Duplex) => {
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nX-Seen-Path: ${incoming.url}\r\nX-Seen-Auth: ${incoming.headers["authorization"] ?? ""}\r\n\r\n`);
    socket.on("data", (chunk) => socket.write(Buffer.concat([Buffer.from("echo:"), chunk])));
  });
  return server;
}

function upgrade(port: number, path: string): Promise<{ status: number; headers: Record<string, unknown>; socket?: Duplex }> {
  return new Promise((resolve, reject) => {
    const outgoing = request({ host: "127.0.0.1", port, path, headers: { Connection: "Upgrade", Upgrade: "websocket", Authorization: "Bearer t" } });
    outgoing.on("upgrade", (response, socket) => resolve({ status: response.statusCode ?? 0, headers: response.headers, socket }));
    outgoing.on("response", (response) => {
      response.resume();
      resolve({ status: response.statusCode ?? 0, headers: response.headers });
    });
    outgoing.on("error", reject);
    outgoing.end();
  });
}

afterEach(async () => {
  for (const socket of sockets) socket.destroy();
  sockets.clear();
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

describe("realtime socket proxy (local stand-in for the ALB /ws* rule)", () => {
  it("matches the ALB path pattern", () => {
    expect(isRealtimeSocketPath("/ws")).toBe(true);
    expect(isRealtimeSocketPath("/ws?vsn=2")).toBe(true);
    expect(isRealtimeSocketPath("/api/v1/ws")).toBe(false);
  });

  it("tunnels a /ws upgrade to realtime both ways with path and headers intact", async () => {
    const realtimePort = await listen(echoingRealtime());
    const gateway = createServer();
    attachRealtimeSocketProxy(gateway, `http://127.0.0.1:${realtimePort}`, logger);
    const gatewayPort = await listen(gateway);
    const result = await upgrade(gatewayPort, "/ws?client=test");
    expect(result.status).toBe(101);
    expect(result.headers["x-seen-path"]).toBe("/ws?client=test");
    expect(result.headers["x-seen-auth"]).toBe("Bearer t");
    const reply = await new Promise<string>((resolve) => {
      result.socket?.once("data", (chunk: Buffer) => resolve(chunk.toString()));
      result.socket?.write("hello");
    });
    expect(reply).toBe("echo:hello");
    result.socket?.destroy();
  });

  it("refuses upgrades on other paths and reports an unreachable realtime as 502", async () => {
    const gateway = createServer();
    attachRealtimeSocketProxy(gateway, "http://127.0.0.1:9", logger);
    const gatewayPort = await listen(gateway);
    expect((await upgrade(gatewayPort, "/api/v1/feed")).status).toBe(404);
    expect((await upgrade(gatewayPort, "/ws")).status).toBe(502);
  });
});
