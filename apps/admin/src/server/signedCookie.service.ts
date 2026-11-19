import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

import { readSessionSigningSecret } from "@/config/adminEnvironment.config";

interface SignedEnvelope<Payload> {
  readonly payload: Payload;
  readonly expiresAtEpochSeconds: number;
}

const gcmIvBytes = 12;
const gcmAuthTagBytes = 16;

function deriveEncryptionKeyForPurpose(purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", Buffer.from(readSessionSigningSecret(), "utf8"), Buffer.alloc(0), Buffer.from(`signed-cookie:${purpose}`, "utf8"), 32));
}

function computeSignatureForText(text: string, purpose: string): string {
  return createHmac("sha256", readSessionSigningSecret()).update(`${purpose}:${text}`).digest("base64url");
}

function areSignaturesEqualInConstantTime(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function signPayloadIntoCookieValue<Payload>(payload: Payload, purpose: string, lifetimeInSeconds: number): string {
  const envelope: SignedEnvelope<Payload> = { payload, expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + lifetimeInSeconds };
  const iv = randomBytes(gcmIvBytes);
  const cipher = createCipheriv("aes-256-gcm", deriveEncryptionKeyForPurpose(purpose), iv);
  cipher.setAAD(Buffer.from(purpose, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(envelope), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${authTag.toString("base64url")}`;
}

export function verifySignedCookieValueAndReadPayload<Payload>(cookieValue: string | undefined, purpose: string): Payload | null {
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return null;
  const [encodedIv, encodedCiphertext, encodedTag] = parts;
  if (!encodedIv || !encodedCiphertext || !encodedTag) return null;
  try {
    const iv = Buffer.from(encodedIv, "base64url");
    const ciphertext = Buffer.from(encodedCiphertext, "base64url");
    const authTag = Buffer.from(encodedTag, "base64url");
    if (iv.length !== gcmIvBytes || authTag.length !== gcmAuthTagBytes) return null;
    const decipher = createDecipheriv("aes-256-gcm", deriveEncryptionKeyForPurpose(purpose), iv);
    decipher.setAAD(Buffer.from(purpose, "utf8"));
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    const envelope = JSON.parse(plaintext) as SignedEnvelope<Payload>;
    if (typeof envelope.expiresAtEpochSeconds !== "number" || envelope.expiresAtEpochSeconds < Date.now() / 1000) return null;
    return envelope.payload;
  } catch {
    return null;
  }
}

export function deriveCsrfTokenForSession(sessionId: string): string {
  return computeSignatureForText(sessionId, "csrf");
}

export function isCsrfTokenValidForSession(sessionId: string | undefined, receivedToken: string | null): boolean {
  if (!sessionId || !receivedToken) return false;
  return areSignaturesEqualInConstantTime(deriveCsrfTokenForSession(sessionId), receivedToken);
}
