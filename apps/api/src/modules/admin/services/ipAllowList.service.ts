import { BlockList, isIP } from "node:net";

function stripIpv4MappedPrefix(address: string): string {
  return address.startsWith("::ffff:") && isIP(address.slice(7)) === 4 ? address.slice(7) : address;
}

export function isValidAllowListEntry(entry: string): boolean {
  const [address, prefix, ...rest] = entry.split("/");
  if (rest.length > 0 || address === undefined || isIP(address) === 0) return false;
  if (prefix === undefined) return true;
  const bits = Number(prefix);
  return Number.isInteger(bits) && bits >= 0 && bits <= (isIP(address) === 4 ? 32 : 128);
}

export function ipAddressIsInAllowList(clientIp: string | null, allowList: readonly string[]): boolean {
  if (allowList.length === 0) return true;
  if (clientIp === null) return false;
  const address = stripIpv4MappedPrefix(clientIp);
  const family = isIP(address);
  if (family === 0) return false;
  const allowed = new BlockList();
  for (const entry of allowList) {
    if (!isValidAllowListEntry(entry)) continue;
    const [network = "", prefix] = entry.split("/");
    const type = isIP(network) === 4 ? "ipv4" : "ipv6";
    if (prefix === undefined) allowed.addAddress(network, type);
    else allowed.addSubnet(network, Number(prefix), type);
  }
  return allowed.check(address, family === 4 ? "ipv4" : "ipv6");
}
