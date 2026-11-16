import { BlockList, isIP } from "node:net";

import { createResponseContext, type HttpMiddleware } from "@nantty/fastify-platform";

import { isValidAllowListEntry } from "./adminNetwork.middleware.js";

function normalizeAddress(address: string | null | undefined): string | null {
  if (address === null || address === undefined) return null;
  return address.startsWith("::ffff:") && isIP(address.slice(7)) === 4 ? address.slice(7) : address;
}

function buildBlockList(entries: readonly string[]): BlockList {
  const blocked = new BlockList();
  for (const entry of entries) {
    const [network = "", prefix] = entry.split("/");
    const family = isIP(network) === 4 ? "ipv4" : "ipv6";
    if (prefix === undefined) blocked.addAddress(network, family);
    else blocked.addSubnet(network, Number(prefix), family);
  }
  return blocked;
}

export function createClientIpDenylistMiddleware(entries: readonly string[]): HttpMiddleware {
  if (entries.length === 0) return (_context, next) => next();
  if (entries.some((entry) => !isValidAllowListEntry(entry))) throw new Error("Client IP denylist must contain valid IP addresses or CIDR ranges");

  const blocked = buildBlockList(entries);
  return (context, next) => {
    const address = normalizeAddress(context.request.remoteAddress);
    const family = address === null ? 0 : isIP(address);
    if (address !== null && family !== 0 && !blocked.check(address, family === 4 ? "ipv4" : "ipv6")) return next();
    return createResponseContext({ status: 403 }).json({ message: "Requests from this network are not allowed.", code: "IP_BLOCKED" });
  };
}
