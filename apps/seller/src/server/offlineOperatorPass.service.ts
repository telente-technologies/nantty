import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { readSessionSigningSecret } from "@/config/sellerEnvironment.config";
import { sessionLifetimesInSeconds } from "@/config/sessionCookies.config";

export interface OfflineOperatorPassContents {
  readonly sessionId: string;
  readonly storeId: string;
  readonly staffId: string;
  readonly operatorToken: string;
}

interface SealedEnvelope extends OfflineOperatorPassContents {
  readonly expiresAtEpochSeconds: number;
}

function deriveOfflineOperatorPassKey(): Buffer {
  return createHash("sha256").update(`offlineOperatorPass:${readSessionSigningSecret()}`).digest();
}

export function sealOfflineOperatorPass(contents: OfflineOperatorPassContents): string {
  const envelope: SealedEnvelope = { ...contents, expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + sessionLifetimesInSeconds.posOperator };
  const initialisationVector = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveOfflineOperatorPassKey(), initialisationVector);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(envelope), "utf8"), cipher.final()]);
  return [initialisationVector, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function openOfflineOperatorPassForSession(sealedPass: unknown, sessionId: string, storeId: string): OfflineOperatorPassContents | null {
  if (typeof sealedPass !== "string" || sealedPass.length > 2048) return null;
  const [initialisationVector, authTag, encrypted] = sealedPass.split(".").map((part) => Buffer.from(part, "base64url"));
  if (!initialisationVector || !authTag || !encrypted || initialisationVector.length !== 12 || authTag.length !== 16) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", deriveOfflineOperatorPassKey(), initialisationVector);
    decipher.setAuthTag(authTag);
    const envelope = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")) as SealedEnvelope;
    if (envelope.expiresAtEpochSeconds < Date.now() / 1000 || envelope.sessionId !== sessionId || envelope.storeId !== storeId) return null;
    return { sessionId: envelope.sessionId, storeId: envelope.storeId, staffId: envelope.staffId, operatorToken: envelope.operatorToken };
  } catch {
    return null;
  }
}
