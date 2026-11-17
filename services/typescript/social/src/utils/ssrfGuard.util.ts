import { isIP } from "node:net";

export class BlockedUrlError extends Error {
  public constructor(public readonly reason: string) {
    super(`Blocked URL: ${reason}`);
    this.name = "BlockedUrlError";
  }
}

const allowedPorts = new Set(["", "80", "443"]);
const blockedHostnameSuffixes = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home", ".corp", ".localdomain", ".arpa"];
const blockedHostnames = new Set(["localhost", "metadata", "metadata.google.internal", "instance-data", "kubernetes", "kubernetes.default"]);

const blockedIpv4Ranges: readonly (readonly [string, number])[] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

function extractRawAuthorityHost(rawUrl: string): string | undefined {
  const schemeEnd = rawUrl.indexOf("://");
  if (schemeEnd < 1) return undefined;
  const authorityStart = schemeEnd + 3;
  const authorityEnd = rawUrl.slice(authorityStart).search(/[\\/?#]/);
  const authority = rawUrl.slice(authorityStart, authorityEnd < 0 ? undefined : authorityStart + authorityEnd);
  const hostPort = authority.slice(authority.lastIndexOf("@") + 1);
  if (hostPort.startsWith("[")) {
    const close = hostPort.indexOf("]");
    return close < 0 ? undefined : hostPort.slice(1, close);
  }
  return hostPort.split(":", 1)[0]?.toLowerCase().replace(/\.$/, "");
}

function hasNonCanonicalNumericIpLabel(hostname: string): boolean {
  const labels = hostname.toLowerCase().split(".");
  if (labels.length < 2 || labels.length > 4 || !labels.every((label) => /^(?:\d+|0x[\da-f]+)$/i.test(label))) return false;
  if (labels.length !== 4 || labels.some((label) => /^0x/i.test(label) || (label.length > 1 && label.startsWith("0")))) return true;
  return labels.some((label) => Number(label) > 255);
}

function convertIpv4ToNumber(address: string): number {
  return address.split(".").reduce((total, octet) => total * 256 + Number(octet), 0);
}

function isIpv4InRange(address: string, base: string, prefixLength: number): boolean {
  const size = 2 ** (32 - prefixLength);
  const start = Math.floor(convertIpv4ToNumber(base) / size) * size;
  const value = convertIpv4ToNumber(address);
  return value >= start && value < start + size;
}

export function isPublicIpv4Address(address: string): boolean {
  if (isIP(address) !== 4) return false;
  return !blockedIpv4Ranges.some(([base, prefixLength]) => isIpv4InRange(address, base, prefixLength));
}

function expandIpv6ToGroups(address: string): number[] | undefined {
  let text = address.toLowerCase().split("%")[0] ?? "";
  const embeddedIpv4 = text.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (embeddedIpv4?.[1] !== undefined) {
    const value = convertIpv4ToNumber(embeddedIpv4[1]);
    text = `${text.slice(0, -embeddedIpv4[1].length)}${Math.floor(value / 65536).toString(16)}:${(value % 65536).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return undefined;
  const head = halves[0] === "" || halves[0] === undefined ? [] : halves[0].split(":");
  const tail = halves.length === 2 && halves[1] !== "" && halves[1] !== undefined ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 && missing !== 0) return undefined;
  if (missing < 0) return undefined;
  const groups = [...head, ...Array.from({ length: halves.length === 2 ? missing : 0 }, () => "0"), ...tail].map((group) => Number.parseInt(group, 16));
  return groups.length === 8 && groups.every((group) => Number.isInteger(group) && group >= 0 && group <= 0xffff) ? groups : undefined;
}

function convertGroupsToIpv4(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}

export function isPublicIpv6Address(address: string): boolean {
  if (isIP(address.split("%")[0] ?? "") !== 6) return false;
  const groups = expandIpv6ToGroups(address);
  if (groups === undefined) return false;
  const [first = 0, second = 0, , , , sixth = 0, seventh = 0, eighth = 0] = groups;
  if (groups.every((group) => group === 0)) return false;
  if (groups.slice(0, 7).every((group) => group === 0) && eighth === 1) return false;
  if (groups.slice(0, 5).every((group) => group === 0) && (sixth === 0xffff || sixth === 0)) return isPublicIpv4Address(convertGroupsToIpv4(seventh, eighth));
  if (first === 0x64 && second === 0xff9b) return isPublicIpv4Address(convertGroupsToIpv4(seventh, eighth));
  if (first === 0x2002) return isPublicIpv4Address(convertGroupsToIpv4(second, groups[2] ?? 0));
  if ((first & 0xfe00) === 0xfc00) return false;
  if ((first & 0xffc0) === 0xfe80 || (first & 0xffc0) === 0xfec0) return false;
  if ((first & 0xff00) === 0xff00) return false;
  if (first === 0x2001 && (second === 0x0db8 || second === 0)) return false;
  if (first === 0x0100 && second === 0 && groups[2] === 0 && groups[3] === 0) return false;
  return (first & 0xe000) === 0x2000;
}

export function isPublicIpAddress(address: string): boolean {
  const version = isIP(address.split("%")[0] ?? "");
  if (version === 4) return isPublicIpv4Address(address);
  if (version === 6) return isPublicIpv6Address(address);
  return false;
}

export function assertUrlIsSafeToFetch(rawUrl: string): URL {
  const rawHost = extractRawAuthorityHost(rawUrl);
  if (rawHost !== undefined && hasNonCanonicalNumericIpLabel(rawHost)) throw new BlockedUrlError("non-canonical numeric address");
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError("not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedUrlError("only http and https are allowed");
  if (url.username !== "" || url.password !== "") throw new BlockedUrlError("credentials are not allowed");
  if (!allowedPorts.has(url.port)) throw new BlockedUrlError("only ports 80 and 443 are allowed");
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (hostname === "" || blockedHostnames.has(hostname) || blockedHostnameSuffixes.some((suffix) => hostname.endsWith(suffix))) throw new BlockedUrlError("internal hostname");
  if (isIP(hostname) !== 0) {
    if (!isPublicIpAddress(hostname)) throw new BlockedUrlError("private address");
  } else if (!hostname.includes(".") || /^\d+$/.test(hostname.replaceAll(".", "")) || /^0x/i.test(hostname)) {
    throw new BlockedUrlError("ambiguous hostname");
  }
  return url;
}

export interface ResolvedAddress {
  readonly address: string;
  readonly family: number;
}

export type AddressLookup = (hostname: string) => Promise<readonly ResolvedAddress[]>;

export async function resolvePublicAddressOrThrow(hostname: string, lookup: AddressLookup): Promise<ResolvedAddress> {
  const bare = hostname.replace(/^\[|\]$/g, "");
  if (isIP(bare) !== 0) {
    if (!isPublicIpAddress(bare)) throw new BlockedUrlError("private address");
    return { address: bare, family: isIP(bare) };
  }
  const addresses = await lookup(bare).catch(() => {
    throw new BlockedUrlError("host could not be resolved");
  });
  if (addresses.length === 0) throw new BlockedUrlError("host could not be resolved");
  if (addresses.some((candidate) => !isPublicIpAddress(candidate.address))) throw new BlockedUrlError("host resolves to a private address");
  return addresses[0] as ResolvedAddress;
}
