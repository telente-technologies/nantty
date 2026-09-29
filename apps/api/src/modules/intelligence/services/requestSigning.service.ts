import { createHash, createHmac, randomBytes } from "node:crypto";

export const SIGNATURE_VERSION = "v1";

export interface SignedRequestHeaders {
  readonly "content-type": "application/json";
  readonly "x-zudo-timestamp": string;
  readonly "x-zudo-nonce": string;
  readonly "x-zudo-signature": string;
}

export interface SigningInput {
  readonly secret: string;
  readonly method: string;
  readonly pathWithQuery: string;
  readonly body: string;
  readonly timestampSeconds: number;
  readonly nonce: string;
}

export function createRequestNonce(): string {
  return randomBytes(18).toString("base64url");
}

export function buildCanonicalRequestString(input: Omit<SigningInput, "secret">): string {
  const bodyDigest = createHash("sha256").update(input.body, "utf8").digest("hex");
  return [SIGNATURE_VERSION, input.method.toUpperCase(), input.pathWithQuery, String(input.timestampSeconds), input.nonce, bodyDigest].join("\n");
}

export function signIntelligenceRequest(input: SigningInput): SignedRequestHeaders {
  const signature = createHmac("sha256", input.secret).update(buildCanonicalRequestString(input), "utf8").digest("hex");
  return {
    "content-type": "application/json",
    "x-zudo-timestamp": String(input.timestampSeconds),
    "x-zudo-nonce": input.nonce,
    "x-zudo-signature": `${SIGNATURE_VERSION}=${signature}`,
  };
}
