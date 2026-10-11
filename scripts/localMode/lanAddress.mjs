import { networkInterfaces } from "node:os";

// First private IPv4 address on a real interface (Wi-Fi or Ethernet), skipping Docker, VPN and loopback interfaces.
export function detectLanAddress() {
  const candidates = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    if (/^(docker|br-|veth|virbr|vmnet|tun|tap|wg|lo)/.test(name)) continue;
    for (const address of addresses ?? []) if (address.family === "IPv4" && !address.internal) candidates.push(address.address);
  }
  return candidates.find((address) => address.startsWith("192.168.")) ?? candidates.find((address) => /^(10|172)\./.test(address)) ?? candidates[0] ?? null;
}
