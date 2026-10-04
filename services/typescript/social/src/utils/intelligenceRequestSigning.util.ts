import { createHash, createHmac, randomBytes } from "node:crypto";

export function signIntelligenceRequest(secret: string, method: string, path: string, body: string, nowMilliseconds = Date.now()): Record<string, string> {
  const timestamp = Math.floor(nowMilliseconds / 1000).toString();
  const nonce = randomBytes(18).toString("base64url");
  const canonical = ["v1", method, path, timestamp, nonce, createHash("sha256").update(body, "utf8").digest("hex")].join("\n");
  return { "content-type": "application/json", "x-zudo-timestamp": timestamp, "x-zudo-nonce": nonce, "x-zudo-signature": `v1=${createHmac("sha256", secret).update(canonical, "utf8").digest("hex")}` };
}

export interface CircuitBreaker {
  isOpen(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
}

export function createCircuitBreaker(failureThreshold = 5, openMilliseconds = 5000, now: () => number = Date.now): CircuitBreaker {
  let consecutiveFailures = 0;
  let openUntil = 0;
  return {
    isOpen: () => now() < openUntil,
    recordSuccess: () => {
      consecutiveFailures = 0;
    },
    recordFailure: () => {
      consecutiveFailures += 1;
      if (consecutiveFailures >= failureThreshold) {
        openUntil = now() + openMilliseconds;
        consecutiveFailures = 0;
      }
    },
  };
}
