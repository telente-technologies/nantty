function parseIpv4ToNumber(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function normaliseAddress(address: string): string {
  const trimmed = address.trim().toLowerCase();
  return trimmed.startsWith("::ffff:") && trimmed.includes(".") ? trimmed.slice(7) : trimmed;
}

export function isValidAllowListEntry(entry: string): boolean {
  const [base, prefix] = entry.split("/");
  if (!base) return false;
  if (prefix === undefined) return parseIpv4ToNumber(base) !== null || base.includes(":");
  return parseIpv4ToNumber(base) !== null && /^\d{1,2}$/.test(prefix) && Number(prefix) <= 32;
}

function doesEntryMatchAddress(entry: string, address: string): boolean {
  const [base, prefix] = entry.split("/");
  if (!base) return false;
  if (prefix === undefined) return normaliseAddress(base) === address;
  const network = parseIpv4ToNumber(base);
  const candidate = parseIpv4ToNumber(address);
  if (network === null || candidate === null) return false;
  const bits = Number(prefix);
  if (bits === 0) return true;
  const blockSize = 2 ** (32 - bits);
  return Math.floor(network / blockSize) === Math.floor(candidate / blockSize);
}

export function isAddressInAllowList(allowList: readonly string[], address: string): boolean {
  if (allowList.length === 0) return true;
  const normalised = normaliseAddress(address);
  if (!normalised) return false;
  return allowList.some((entry) => doesEntryMatchAddress(entry, normalised));
}
