import { hmacSha256, timingSafeEqualString } from "@zudojs/crypto";

export function hashSecretWithKey(value: string, key: Uint8Array): Promise<string> {
  return hmacSha256(value, key, "hex");
}

export function hashesAreEqual(left: string, right: string): boolean {
  return timingSafeEqualString(left, right);
}
