import { getRandomBytes } from "expo-crypto";

function readRandomBytes(byteLength: number): Uint8Array {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.getRandomValues === "function") {
    return webCrypto.getRandomValues(new Uint8Array(byteLength));
  }
  const builtin = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process?.getBuiltinModule?.("node:crypto") as
    | { webcrypto?: { getRandomValues?: (view: Uint8Array) => Uint8Array } }
    | undefined;
  if (builtin?.webcrypto?.getRandomValues) {
    return builtin.webcrypto.getRandomValues(new Uint8Array(byteLength));
  }
  return getRandomBytes(byteLength);
}

export function createSecureRandomHex(byteLength = 8): string {
  const bytes = readRandomBytes(byteLength);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
