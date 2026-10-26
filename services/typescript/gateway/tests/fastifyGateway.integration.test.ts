import { createServer, request, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Duplex } from "node:stream";

import { afterEach, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import type { GatewayConfig } from "../src/configs/gateway.config.js";

const servers: Server[] = [];
const sockets = new Set<Duplex>();

async function listen(server: Server): Promise<number> {
  servers.push(server);
  server.on("connection", (socket) => sockets.add(socket));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return (server.address() as AddressInfo).port;
}

function realtimeServer(): Server {
  const server = createServer((_request, response) => response.writeHead(426).end());
  server.on("upgrade", (incoming: IncomingMessage, socket: Duplex) => {
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nX-Seen-Path: ${incoming.url}\r\nX-Seen-Auth: ${incoming.headers.authorization ?? ""}\r\n\r\n`);
    socket.on("data", (chunk) => socket.write(Buffer.concat([Buffer.from("echo:"), chunk])));
  });
  return server;
}

function upgrade(port: number, path: string): Promise<{ status: number; headers: Record<string, unknown>; socket?: Duplex }> {
  return new Promise((resolve, reject) => {
    const outgoing = request({ host: "127.0.0.1", port, path, headers: { Connection: "Upgrade", Upgrade: "websocket", Authorization: "Bearer realtime-test" } });
    outgoing.on("upgrade", (response, socket) => resolve({ status: response.statusCode ?? 0, headers: response.headers, socket }));
    outgoing.on("response", (response) => { response.resume(); resolve({ status: response.statusCode ?? 0, headers: response.headers }); });
    outgoing.on("error", reject);
    outgoing.end();
  });
}

function config(upstream: string, realtime: string | null = null): GatewayConfig {
  return {
    host: "127.0.0.1",
    port: 0,
    corsOrigins: ["https://app.nantty.test"],
    rateLimitMaxPerMinute: 0,
    upstreamTimeoutMs: 2_000,
    policyGate: null,
    guestRateLimits: { perMinute: 1000, sensitivePerMinute: 1000 },
    accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer: "https://auth.nantty.test", audience: "nantty-api" },
    maxRequestBodyBytes: 1024,
    trustedProxyHops: 0,
    adminIpAllowList: ["192.0.2.0/24"],
    realtimeUpstream: realtime,
    upstreams: { identity: upstream, live: upstream, money: upstream, notifications: upstream, social: upstream, trust: upstream, commerce: upstream, media: upstream, search: upstream, ads: upstream, support: upstream },
  };
}

afterEach(async () => {
  for (const socket of sockets) socket.destroy();
  sockets.clear();
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("Fastify Gateway HTTP contract", () => {
  it("keeps security and CORS behavior, including request-id validation", async () => {
    const upstream = createServer((_request, response) => response.writeHead(200).end("{}"));
    const upstreamPort = await listen(upstream);
    const gateway = createGatewayServer({ config: config(`http://127.0.0.1:${upstreamPort}`) });
    await gateway.start();
    const base = `http://127.0.0.1:${gateway.address?.port}`;

    const health = await fetch(`${base}/healthz`, { headers: { origin: "https://app.nantty.test", "x-request-id": "safe:request-1" } });
    expect(health.status).toBe(200);
    expect(health.headers.get("x-content-type-options")).toBe("nosniff");
    expect(health.headers.get("x-frame-options")).toBe("DENY");
    expect(health.headers.get("access-control-allow-origin")).toBe("https://app.nantty.test");
    expect(health.headers.get("x-request-id")).toBe("safe:request-1");

    const rejected = await fetch(`${base}/healthz`, { headers: { origin: "https://evil.test", "x-request-id": "bad@id" } });
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get("access-control-allow-origin")).toBeNull();
    expect(rejected.headers.get("x-request-id")).not.toBe("bad@id");

    const preflight = await fetch(`${base}/api/v1/posts`, { method: "OPTIONS", headers: { origin: "https://app.nantty.test", "access-control-request-method": "POST" } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-headers")).toContain("Idempotency-Key");

    await gateway.stop();
  });

  it("preserves the legacy adapter's oversized-body response and admin-network gate", async () => {
    const upstream = createServer((_request, response) => response.writeHead(200).end("{}"));
    const upstreamPort = await listen(upstream);
    const gateway = createGatewayServer({ config: config(`http://127.0.0.1:${upstreamPort}`) });
    await gateway.start();
    const base = `http://127.0.0.1:${gateway.address?.port}`;

    const tooLarge = await fetch(`${base}/api/v1/auth/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: "x".repeat(2048) }) });
    expect(tooLarge.status).toBe(413);
    expect(await tooLarge.json()).toEqual({ error: "Payload Too Large", code: "PAYLOAD_TOO_LARGE" });
    expect(tooLarge.headers.get("x-content-type-options")).toBe("nosniff");

    const admin = await fetch(`${base}/api/v1/admin/audit`);
    expect(admin.status).toBe(403);
    expect(await admin.json()).toEqual({ message: "The admin console cannot be used from this network.", code: "IP_NOT_ALLOWED" });
    await gateway.stop();
  });

  it("attaches realtime upgrades to Fastify's HTTP server without changing the /ws tunnel contract", async () => {
    const realtime = realtimeServer();
    const realtimePort = await listen(realtime);
    const upstream = createServer((_request, response) => response.writeHead(200).end("{}"));
    const upstreamPort = await listen(upstream);
    const gateway = createGatewayServer({ config: config(`http://127.0.0.1:${upstreamPort}`, `http://127.0.0.1:${realtimePort}`) });
    await gateway.start();
    const gatewayPort = gateway.address?.port;
    if (gatewayPort === undefined) throw new Error("Gateway did not bind a port");

    const result = await upgrade(gatewayPort, "/ws?client=test");
    expect(result.status).toBe(101);
    expect(result.headers["x-seen-path"]).toBe("/ws?client=test");
    expect(result.headers["x-seen-auth"]).toBe("Bearer realtime-test");
    const reply = await new Promise<string>((resolve) => {
      result.socket?.once("data", (chunk: Buffer) => resolve(chunk.toString()));
      result.socket?.write("hello");
    });
    expect(reply).toBe("echo:hello");
    result.socket?.destroy();
    await gateway.stop();
  });
});
