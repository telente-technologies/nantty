import { createHash, randomBytes } from "node:crypto";

export function createGroupInvitationLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashGroupInvitationLinkToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isGroupInvitationLinkToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
