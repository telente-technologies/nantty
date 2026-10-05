import { BlockList, isIP } from "node:net";

import { createResponseContext, type HttpMiddleware } from "@zudojs/http";

const adminPathPrefix = "/api/v1/admin/";

export function isValidAllowListEntry(entry: string): boolean {
  const [address, prefix, ...rest] = entry.split("/");
  if (rest.length > 0 || address === undefined || isIP(address) === 0) return false;
  if (prefix === undefined) return true;
  const bits = Number(prefix);
  return /^\d+$/.test(prefix) && bits >= 0 && bits <= (isIP(address) === 4 ? 32 : 128);
}

function buildBlockList(entries: readonly string[]): BlockList {
  const allowed = new BlockList();
  for (const entry of entries) {
    const [network = "", prefix] = entry.split("/");
    const type = isIP(network) === 4 ? "ipv4" : "ipv6";
    if (prefix === undefined) allowed.addAddress(network, type);
    else allowed.addSubnet(network, Number(prefix), type);
  }
  return allowed;
}

function normalizeAddress(address: string | null | undefined): string | null {
  if (address === null || address === undefined) return null;
  return address.startsWith("::ffff:") && isIP(address.slice(7)) === 4 ? address.slice(7) : address;
}

export function createAdminNetworkMiddleware(allowList: readonly string[]): HttpMiddleware {
  if (allowList.length === 0) return (_context, next) => next();
  const allowed = buildBlockList(allowList);
  return (context, next) => {
    if (!context.request.path.startsWith(adminPathPrefix)) return next();
    const address = normalizeAddress(context.request.remoteAddress);
    const family = address === null ? 0 : isIP(address);
    if (address !== null && family !== 0 && allowed.check(address, family === 4 ? "ipv4" : "ipv6")) return next();
    return createResponseContext({ status: 403 }).json({ message: "The admin console cannot be used from this network.", code: "IP_NOT_ALLOWED" });
  };
}
