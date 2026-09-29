import { createHmac, timingSafeEqual } from "node:crypto";

import { readSessionSigningSecret } from "@/config/adsEnvironment.config";

interface SignedEnvelope<Payload> {
  readonly payload: Payload;
  readonly expiresAtEpochSeconds: number;
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
  const encodedEnvelope = Buffer.from(JSON.stringify(envelope)).toString("base64url");
  return `${encodedEnvelope}.${computeSignatureForText(encodedEnvelope, purpose)}`;
}

export function verifySignedCookieValueAndReadPayload<Payload>(cookieValue: string | undefined, purpose: string): Payload | null {
  if (!cookieValue) return null;
  const separatorIndex = cookieValue.lastIndexOf(".");
  if (separatorIndex <= 0) return null;
  const encodedEnvelope = cookieValue.slice(0, separatorIndex);
  const receivedSignature = cookieValue.slice(separatorIndex + 1);
  if (!areSignaturesEqualInConstantTime(computeSignatureForText(encodedEnvelope, purpose), receivedSignature)) return null;
  try {
    const envelope = JSON.parse(Buffer.from(encodedEnvelope, "base64url").toString("utf8")) as SignedEnvelope<Payload>;
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
