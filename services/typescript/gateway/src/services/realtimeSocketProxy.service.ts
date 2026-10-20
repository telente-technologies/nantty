import { createServer, request as httpRequest, type IncomingHttpHeaders, type IncomingMessage, type Server } from "node:http";
import { pipeline, type Duplex } from "node:stream";

import type { Logger } from "@zudojs/logger";

const hopByHopHeaders = new Set(["host", "proxy-connection", "keep-alive", "transfer-encoding", "te", "trailer"]);

export function isRealtimeSocketPath(url: string | undefined): boolean {
  return (url ?? "").startsWith("/ws");
}

function refuse(socket: Duplex, status: string): void {
  if (socket.writable) socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  else socket.destroy();
}

function forwardedHeaders(incoming: IncomingMessage, targetHost: string): IncomingHttpHeaders {
  const headers: IncomingHttpHeaders = {};
  for (const [name, value] of Object.entries(incoming.headers)) if (!hopByHopHeaders.has(name)) headers[name] = value;
  headers.host = targetHost;
  return headers;
}

function switchingProtocolsHead(response: IncomingMessage): string {
  const lines = ["HTTP/1.1 101 Switching Protocols"];
  for (let index = 0; index < response.rawHeaders.length; index += 2) lines.push(`${response.rawHeaders[index]}: ${response.rawHeaders[index + 1]}`);
  return `${lines.join("\r\n")}\r\n\r\n`;
}

// Local stand-in for the ALB rule that sends /ws* straight to realtime in AWS.
export function attachRealtimeSocketProxy(server: Server, upstreamUrl: string, logger: Logger): void {
  const upstream = new URL(upstreamUrl);
  const open = new Set<Duplex>();
  server.on("close", () => {
    for (const socket of open) socket.destroy();
  });
  server.on("upgrade", (incoming: IncomingMessage, client: Duplex, head: Buffer) => {
    if (!isRealtimeSocketPath(incoming.url)) return refuse(client, "404 Not Found");
    const target = new URL(incoming.url ?? "/ws", upstream);
    const outgoing = httpRequest({ protocol: target.protocol, hostname: target.hostname, port: target.port, path: `${target.pathname}${target.search}`, method: incoming.method, headers: forwardedHeaders(incoming, target.host) });
    client.on("error", () => outgoing.destroy());
    outgoing.on("upgrade", (response, upstreamSocket, upstreamHead) => {
      open.add(client).add(upstreamSocket);
      const forget = () => {
        open.delete(client);
        open.delete(upstreamSocket);
        client.destroy();
        upstreamSocket.destroy();
      };
      client.on("close", forget);
      upstreamSocket.on("close", forget);
      client.write(switchingProtocolsHead(response));
      if (upstreamHead.length > 0) client.write(upstreamHead);
      if (head.length > 0) upstreamSocket.write(head);
      // pipeline (not bare pipe) forwards source errors to the destination and runs the callback on failure.
      pipeline(upstreamSocket, client, (error) => {
        if (error) logger.warn("realtime socket proxy upstream stream failed", { error: error.message });
        forget();
      });
      pipeline(client, upstreamSocket, (error) => {
        if (error) logger.warn("realtime socket proxy client stream failed", { error: error.message });
        forget();
      });
    });
    outgoing.on("response", (response) => {
      response.resume();
      refuse(client, `${response.statusCode ?? 502} ${response.statusMessage ?? "Bad Gateway"}`);
    });
    outgoing.on("error", (error) => {
      logger.warn("realtime socket proxy could not reach realtime", { error: error.message });
      refuse(client, "502 Bad Gateway");
    });
    outgoing.end();
  });
}

export function createRealtimeProxyingServer(upstreamUrl: string | null | undefined, logger: Logger): Server | undefined {
  if (!upstreamUrl) return undefined;
  const server = createServer();
  attachRealtimeSocketProxy(server, upstreamUrl, logger);
  return server;
}
