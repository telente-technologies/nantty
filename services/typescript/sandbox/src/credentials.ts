import { createHash, randomBytes } from "node:crypto";

export function createSandboxCredential(): { readonly token: string; readonly tokenHash: string; readonly prefix: string } {
  const token = `ntsb_test_${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashSandboxCredential(token), prefix: token.slice(0, 18) };
}

export function hashSandboxCredential(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isSandboxCredentialFormat(token: string): boolean {
  return /^ntsb_test_[A-Za-z0-9_-]{40,50}$/.test(token);
}
